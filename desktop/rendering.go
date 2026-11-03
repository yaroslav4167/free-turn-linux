package main

import (
	"errors"
	"slices"

	"github.com/samosvalishe/free-turn-proxy/desktop/integration"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
)

func initialRenderingMode(preference string, args []string) string {
	// Recovery for a driver issue that prevents opening the settings screen.
	// This override applies only to the current process, not to the saved setting.
	if slices.Contains(args, "--software-rendering") {
		return integration.RenderingSoftware
	}
	return integration.NormalizeRenderingMode(preference)
}

func webviewGPUPolicy(mode string) linux.WebviewGpuPolicy {
	switch mode {
	case integration.RenderingHardware:
		return linux.WebviewGpuPolicyAlways
	case integration.RenderingSoftware:
		return linux.WebviewGpuPolicyNever
	default:
		// Let WebKit use acceleration when content and the available driver support
		// it. Do not force software rendering or claim that a GPU is actually in use.
		return linux.WebviewGpuPolicyOnDemand
	}
}

// The WebKit policy is applied when creating the window, on the next launch.
func (a *App) SetRenderingMode(mode string) error {
	if !integration.ValidRenderingMode(mode) {
		return errors.New("неизвестный режим отрисовки")
	}
	a.desktopMu.Lock()
	defer a.desktopMu.Unlock()
	prefs := a.preferences
	prefs.RenderingMode = mode
	if err := integration.SavePreferences(prefs); err != nil {
		return err
	}
	a.preferences = prefs
	return nil
}
