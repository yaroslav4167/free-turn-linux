package main

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/samosvalishe/free-turn-proxy/desktop/integration"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
)

func TestWebviewGPUPolicy(t *testing.T) {
	for _, test := range []struct {
		mode string
		want linux.WebviewGpuPolicy
	}{
		{"", linux.WebviewGpuPolicyOnDemand},
		{"auto", linux.WebviewGpuPolicyOnDemand},
		{"hardware", linux.WebviewGpuPolicyAlways},
		{"software", linux.WebviewGpuPolicyNever},
		{"unknown", linux.WebviewGpuPolicyOnDemand},
	} {
		if got := webviewGPUPolicy(test.mode); got != test.want {
			t.Fatalf("mode %q: policy %v, want %v", test.mode, got, test.want)
		}
	}
}

func TestInitialRenderingModeAndSoftwareRecovery(t *testing.T) {
	for _, test := range []struct {
		mode string
		args []string
		want string
	}{
		{"", nil, "auto"}, {"auto", nil, "auto"}, {"hardware", nil, "hardware"}, {"software", nil, "software"},
		{"unknown", nil, "auto"},
		{"auto", []string{"--software-rendering"}, "software"},
		{"hardware", []string{"--autostart", "--software-rendering"}, "software"},
		{"hardware", []string{"--autostart"}, "hardware"},
	} {
		if got := initialRenderingMode(test.mode, test.args); got != test.want {
			t.Fatalf("mode %q args %v: %s, want %s", test.mode, test.args, got, test.want)
		}
	}
}

func TestRenderingPreferencePersistsWithoutChangingRunningPolicy(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("XDG_DATA_HOME", t.TempDir())
	original := integration.Preferences{CloseToTray: true, AutoConnect: true, AutoConnectServerID: "chosen", AutoCheckUpdates: true, RenderingMode: "auto"}
	a := &App{preferences: original, activeRenderingMode: "auto"}
	if err := a.SetRenderingMode("software"); err != nil {
		t.Fatal(err)
	}
	saved, err := integration.LoadPreferences()
	if err != nil {
		t.Fatal(err)
	}
	expected := original
	expected.RenderingMode = "software"
	if !reflect.DeepEqual(saved, expected) {
		t.Fatalf("unrelated preferences changed: %+v", saved)
	}
	settings, err := a.DesktopSettings()
	if err != nil {
		t.Fatal(err)
	}
	if settings.RenderingMode != "software" || settings.ActiveRenderingMode != "auto" || !settings.RenderingRestartRequired {
		t.Fatalf("incorrect restart state: %+v", settings)
	}
	if err := a.SetCloseToTray(false); err != nil {
		t.Fatal(err)
	}
	if err := a.SetAutoCheckUpdates(false); err != nil {
		t.Fatal(err)
	}
	saved, err = integration.LoadPreferences()
	if err != nil || saved.RenderingMode != "software" {
		t.Fatalf("other setters lost renderer: %+v, %v", saved, err)
	}
	if err := a.SetRenderingMode("auto"); err != nil {
		t.Fatal(err)
	}
	settings, err = a.DesktopSettings()
	if err != nil || settings.RenderingRestartRequired {
		t.Fatalf("returning to active mode should clear restart: %+v, %v", settings, err)
	}
}

func TestInvalidRenderingPreferenceIsRejected(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	a := &App{preferences: integration.Preferences{RenderingMode: "auto"}, activeRenderingMode: "auto"}
	if err := a.SetRenderingMode("hardware"); err != nil {
		t.Fatal(err)
	}
	for _, invalid := range []string{"", "invalid", "never"} {
		if err := a.SetRenderingMode(invalid); err == nil {
			t.Fatalf("accepted mode %q", invalid)
		}
	}
	saved, err := integration.LoadPreferences()
	if err != nil || saved.RenderingMode != "hardware" || a.activeRenderingMode != "auto" {
		t.Fatalf("invalid mode changed state: %+v, %v", saved, err)
	}
}

func TestRenderingPreferenceSaveFailureKeepsCurrentSettings(t *testing.T) {
	config := filepath.Join(t.TempDir(), "not-a-directory")
	if err := os.WriteFile(config, []byte("untouched"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("XDG_CONFIG_HOME", config)
	a := &App{preferences: integration.Preferences{RenderingMode: "auto"}, activeRenderingMode: "auto"}
	if err := a.SetRenderingMode("software"); err == nil {
		t.Fatal("failed save must return an error")
	}
	if a.preferences.RenderingMode != "auto" || a.activeRenderingMode != "auto" {
		t.Fatal("failed save changed renderer")
	}
}
