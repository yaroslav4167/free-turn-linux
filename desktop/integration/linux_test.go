//go:build linux

package integration

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func isolateDesktop(t *testing.T) {
	t.Helper()
	t.Setenv("XDG_DATA_HOME", filepath.Join(t.TempDir(), "data with spaces"))
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(t.TempDir(), "config"))
}

func TestDesktopEntry(t *testing.T) {
	entry, err := desktopEntry("/home/user/My Apps/freeturn", true)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(entry, "Exec=\"/home/user/My Apps/freeturn\" --autostart\n") {
		t.Fatalf("invalid Exec: %s", entry)
	}
	entry, err = desktopEntry("/home/$user/100%/free`turn", false)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(entry, "Exec=\"/home/\\\\$user/100%%/free\\\\`turn\"\n") {
		t.Fatalf("unsafe Exec: %s", entry)
	}
	for _, path := range []string{"relative/path", "/bad\nExec=command", "/bad\rpath", "/bad\x00path"} {
		if _, err := desktopEntry(path, false); err == nil {
			t.Fatalf("accepted invalid path %q", path)
		}
	}
}

func TestInstallAndAutostart(t *testing.T) {
	isolateDesktop(t)
	if enabled, err := AutostartEnabled(); err != nil || enabled {
		t.Fatalf("initial autostart: %v, %v", enabled, err)
	}
	if err := SetAutostart(false); err != nil {
		t.Fatal(err)
	}
	path, err := Install()
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o755 {
		t.Fatalf("installed mode: %v", info.Mode())
	}
	entryPath := filepath.Join(os.Getenv("XDG_DATA_HOME"), "applications", "freeturn.desktop")
	entry, err := os.ReadFile(entryPath)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(entry), "--autostart") {
		t.Fatal("application launcher should not hide the window")
	}
	if err := SetAutostart(true); err != nil {
		t.Fatal(err)
	}
	if enabled, err := AutostartEnabled(); err != nil || !enabled {
		t.Fatalf("enabled autostart: %v, %v", enabled, err)
	}
	autoPath, _ := autostartPath()
	entry, err = os.ReadFile(autoPath)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(entry), "--autostart") {
		t.Fatal("autostart flag missing")
	}
	if err := SetAutostart(false); err != nil {
		t.Fatal(err)
	}
	if enabled, err := AutostartEnabled(); err != nil || enabled {
		t.Fatalf("disabled autostart: %v, %v", enabled, err)
	}
}

func TestPreferences(t *testing.T) {
	isolateDesktop(t)
	prefs, err := LoadPreferences()
	if err != nil || !prefs.CloseToTray {
		t.Fatalf("defaults: %+v, %v", prefs, err)
	}
	if err := SavePreferences(Preferences{CloseToTray: false}); err != nil {
		t.Fatal(err)
	}
	prefs, err = LoadPreferences()
	if err != nil || prefs.CloseToTray {
		t.Fatalf("saved preferences: %+v, %v", prefs, err)
	}
}
