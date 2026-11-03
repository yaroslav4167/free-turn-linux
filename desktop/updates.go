package main

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"time"

	"github.com/samosvalishe/free-turn-proxy/desktop/integration"
	"github.com/samosvalishe/free-turn-proxy/desktop/updates"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Set by release builds, independently of the proxy core's version.
var desktopVersion = "dev"
var updateRepository = ""

func (a *App) startUpdateChecks(ctx context.Context) {
	ctx, a.updateCancel = context.WithCancel(ctx)
	a.updateContext = ctx
	go func() {
		timer := time.NewTimer(10 * time.Second)
		defer timer.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-timer.C:
				a.desktopMu.Lock()
				enabled := a.preferences.AutoCheckUpdates
				a.desktopMu.Unlock()
				if enabled && a.updater.State().Repository != "" {
					_ = a.updater.Check(ctx)
				}
				timer.Reset(6 * time.Hour)
			}
		}
	}()
}

func (a *App) UpdateState() updates.State {
	state := a.updater.State()
	state.InstallationMessage, state.BackupPath = a.updateResult.Message, a.updateResult.BackupPath
	return state
}
func (a *App) CheckForUpdates() error { return a.updater.Check(a.updateContext) }

func (a *App) SetAutoCheckUpdates(enabled bool) error {
	a.desktopMu.Lock()
	defer a.desktopMu.Unlock()
	prefs := a.preferences
	prefs.AutoCheckUpdates = enabled
	if err := integration.SavePreferences(prefs); err != nil {
		return err
	}
	a.preferences = prefs
	return nil
}

func (a *App) DownloadUpdate() error {
	state := a.updater.State()
	if !state.Available || state.Busy != "" {
		return errors.New("сначала проверьте доступное обновление")
	}
	destination, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title: "Сохранить обновление FreeTurn", DefaultFilename: state.AssetName,
		Filters: []wailsruntime.FileFilter{{DisplayName: "Архив Linux (*.tar.gz)", Pattern: "*.tar.gz"}},
	})
	if err != nil || destination == "" {
		return err
	}
	return a.updater.Download(a.updateContext, destination, state.LatestVersion)
}

func (a *App) InstallUpdate() error {
	if !integration.Supported {
		return errors.New("установка обновлений поддерживается только на Linux")
	}
	if os.Geteuid() == 0 {
		return errors.New("обновление клиента нельзя запускать от root")
	}
	if !a.updateInstallMu.TryLock() {
		return errors.New("установка уже выполняется")
	}
	defer a.updateInstallMu.Unlock()
	state := a.updater.State()
	if !state.Available || state.Busy != "" {
		return errors.New("сначала проверьте доступное обновление")
	}
	target, err := integration.InstalledPath()
	if err != nil {
		return err
	}
	answer, err := wailsruntime.MessageDialog(a.ctx, wailsruntime.MessageDialogOptions{
		Type: wailsruntime.QuestionDialog, Title: "Установить обновление FreeTurn?",
		Message: "Скачать и проверить " + state.LatestVersion + ", отключить VPN и перезапустить клиент?\nБинарники будут установлены в " + filepath.Dir(target) + ".\nПредыдущая пара сохранится для отката. Профили и настройки сохранятся. Системный VPN-helper автоматически не заменяется.",
		Buttons: []string{"Установить и перезапустить", "Отмена"}, DefaultButton: "Отмена", CancelButton: "Отмена",
	})
	if err != nil || answer != "Установить и перезапустить" {
		return err
	}
	stage, err := a.updater.PrepareInstall(a.updateContext, filepath.Dir(target))
	if err != nil {
		return err
	}
	gate, err := integration.StartUpdateWorker(stage)
	if err != nil {
		_ = os.RemoveAll(stage)
		return err
	}
	a.desktopMu.Lock()
	a.updateInstallGate = gate
	a.desktopMu.Unlock()
	a.Quit()
	return nil
}
