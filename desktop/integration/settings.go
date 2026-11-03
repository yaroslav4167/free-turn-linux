package integration

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type Preferences struct {
	CloseToTray         bool   `json:"closeToTray"`
	AutoConnect         bool   `json:"autoConnect"`
	AutoConnectServerID string `json:"autoConnectServerId"`
}

func preferencesPath() (string, error) {
	dir, err := os.UserConfigDir()
	return filepath.Join(dir, "FreeTurnDesktop", "desktop.json"), err
}

func LoadPreferences() (Preferences, error) {
	prefs := Preferences{CloseToTray: true}
	path, err := preferencesPath()
	if err != nil {
		return prefs, err
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return prefs, nil
	}
	if err != nil {
		return prefs, err
	}
	err = json.Unmarshal(data, &prefs)
	return prefs, err
}

func SavePreferences(prefs Preferences) error {
	path, err := preferencesPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(prefs, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".desktop-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}
