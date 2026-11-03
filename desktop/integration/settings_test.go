package integration

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAutoConnectDefaultsAndMigration(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	prefs, err := LoadPreferences()
	if err != nil || prefs.AutoConnect {
		t.Fatalf("autoconnect must default off: %+v, %v", prefs, err)
	}
	path, _ := preferencesPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(`{"closeToTray":false}`), 0o600); err != nil {
		t.Fatal(err)
	}
	prefs, err = LoadPreferences()
	if err != nil || prefs.AutoConnect || prefs.CloseToTray {
		t.Fatalf("bad migration: %+v, %v", prefs, err)
	}
}
