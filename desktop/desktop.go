package main

import (
	"context"
	"errors"
	"os"
	"slices"

	"github.com/samosvalishe/free-turn-proxy/desktop/integration"
	"github.com/samosvalishe/free-turn-proxy/desktop/tray"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type DesktopSettings struct {
	CloseToTray        bool   `json:"closeToTray"`
	Autostart          bool   `json:"autostart"`
	Supported          bool   `json:"supported"`
	TrayAvailable      bool   `json:"trayAvailable"`
	TrayError          string `json:"trayError"`
	InstalledPath      string `json:"installedPath"`
	VPNHelperAvailable bool   `json:"vpnHelperAvailable"`
}

func (a *App) startTray() {
	t, err := tray.Start("FreeTurn", a.ShowWindow, a.Quit)
	a.desktopMu.Lock()
	defer a.desktopMu.Unlock()
	a.tray = t
	if err != nil {
		a.trayError = err.Error()
	}
}

func (a *App) beforeClose(ctx context.Context) bool {
	a.desktopMu.Lock()
	defer a.desktopMu.Unlock()
	if !a.quitting && a.preferences.CloseToTray && a.tray != nil && a.tray.Available() {
		wailsruntime.WindowHide(ctx)
		return true
	}
	return false
}

func (a *App) domReady(ctx context.Context) {
	// An autostarted app must remain visible when no tray host is available.
	if slices.Contains(os.Args[1:], "--autostart") {
		_ = a.MinimiseToTray()
	}
}

func (a *App) DesktopSettings() (DesktopSettings, error) {
	a.desktopMu.Lock()
	defer a.desktopMu.Unlock()
	autostart, err := integration.AutostartEnabled()
	if err != nil {
		return DesktopSettings{}, err
	}
	path, err := integration.InstalledPath()
	if err != nil {
		return DesktopSettings{}, err
	}
	return DesktopSettings{
		CloseToTray: a.preferences.CloseToTray, Autostart: autostart,
		Supported: integration.Supported, TrayAvailable: a.tray != nil && a.tray.Available(),
		TrayError: a.trayError, InstalledPath: path,
		VPNHelperAvailable: integration.VPNHelperAvailable(),
	}, nil
}

func (a *App) SetCloseToTray(enabled bool) error {
	a.desktopMu.Lock()
	defer a.desktopMu.Unlock()
	prefs := integration.Preferences{CloseToTray: enabled}
	if err := integration.SavePreferences(prefs); err != nil {
		return err
	}
	a.preferences = prefs
	return nil
}

func (a *App) SetAutostart(enabled bool) error { return integration.SetAutostart(enabled) }
func (a *App) InstallDesktop() (string, error) { return integration.Install() }

func (a *App) InstallVPNHelper() error { return integration.ConfigureVPNHelper(false) }
func (a *App) RemoveVPNHelper() error  { return integration.ConfigureVPNHelper(true) }

func (a *App) MinimiseToTray() error {
	a.desktopMu.Lock()
	defer a.desktopMu.Unlock()
	if a.tray == nil || !a.tray.Available() {
		return errors.New("системный трей недоступен; в GNOME установите расширение AppIndicator")
	}
	wailsruntime.WindowHide(a.ctx)
	return nil
}
