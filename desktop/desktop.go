package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"slices"

	"github.com/samosvalishe/free-turn-proxy/desktop/integration"
	"github.com/samosvalishe/free-turn-proxy/desktop/tray"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type DesktopSettings struct {
	CloseToTray              bool   `json:"closeToTray"`
	Autostart                bool   `json:"autostart"`
	AutoConnect              bool   `json:"autoConnect"`
	AutoConnectServerID      string `json:"autoConnectServerId"`
	AutoConnectError         string `json:"autoConnectError"`
	AutoCheckUpdates         bool   `json:"autoCheckUpdates"`
	RenderingMode            string `json:"renderingMode"`
	ActiveRenderingMode      string `json:"activeRenderingMode"`
	RenderingRestartRequired bool   `json:"renderingRestartRequired"`
	Supported                bool   `json:"supported"`
	TrayAvailable            bool   `json:"trayAvailable"`
	TrayError                string `json:"trayError"`
	InstalledPath            string `json:"installedPath"`
	VPNHelperAvailable       bool   `json:"vpnHelperAvailable"`
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
	integration.AcknowledgeUpdate()
	// An autostarted app must remain visible when no tray host is available.
	if slices.Contains(os.Args[1:], "--autostart") {
		_ = a.MinimiseToTray()
	}
	if err := a.connectOnLaunch(a.Connect); err != nil {
		a.desktopMu.Lock()
		a.autoConnectError = fmt.Sprintf("Автоподключение: %v", err)
		a.desktopMu.Unlock()
		a.ShowWindow()
	}
}

func (a *App) connectOnLaunch(connect func(string) error) error {
	var err error
	a.autoConnectOnce.Do(func() {
		a.desktopMu.Lock()
		prefs := a.preferences
		a.desktopMu.Unlock()
		if prefs.AutoConnect {
			err = connect(prefs.AutoConnectServerID)
		}
	})
	return err
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
		AutoConnect: a.preferences.AutoConnect, AutoConnectServerID: a.preferences.AutoConnectServerID,
		AutoConnectError:         a.autoConnectError,
		AutoCheckUpdates:         a.preferences.AutoCheckUpdates,
		RenderingMode:            integration.NormalizeRenderingMode(a.preferences.RenderingMode),
		ActiveRenderingMode:      integration.NormalizeRenderingMode(a.activeRenderingMode),
		RenderingRestartRequired: integration.NormalizeRenderingMode(a.preferences.RenderingMode) != integration.NormalizeRenderingMode(a.activeRenderingMode),
		Supported:                integration.Supported, TrayAvailable: a.tray != nil && a.tray.Available(),
		TrayError: a.trayError, InstalledPath: path,
		VPNHelperAvailable: integration.VPNHelperAvailable(),
	}, nil
}

func (a *App) SetCloseToTray(enabled bool) error {
	a.desktopMu.Lock()
	defer a.desktopMu.Unlock()
	prefs := a.preferences
	prefs.CloseToTray = enabled
	if err := integration.SavePreferences(prefs); err != nil {
		return err
	}
	a.preferences = prefs
	return nil
}

func (a *App) SetAutostart(enabled bool) error { return integration.SetAutostart(enabled) }

// SetAutoConnect only configures the next application launch; it never connects now.
func (a *App) SetAutoConnect(enabled bool, serverID string) error {
	if enabled {
		if _, ok := a.store.Get(serverID); !ok {
			return errors.New("выберите существующий профиль для автоподключения")
		}
	}
	a.desktopMu.Lock()
	defer a.desktopMu.Unlock()
	prefs := a.preferences
	prefs.AutoConnect, prefs.AutoConnectServerID = enabled, serverID
	if err := integration.SavePreferences(prefs); err != nil {
		return err
	}
	a.preferences = prefs
	return nil
}
func (a *App) InstallDesktop() (string, error)        { return integration.Install() }
func (a *App) CreateDesktopShortcut() (string, error) { return integration.CreateDesktopShortcut() }

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
