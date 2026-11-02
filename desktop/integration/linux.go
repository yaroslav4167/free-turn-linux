//go:build linux

package integration

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/samosvalishe/free-turn-proxy/desktop/backend/vpnservice"
)

const Supported = true

func dataDir() (string, error) {
	if dir := os.Getenv("XDG_DATA_HOME"); filepath.IsAbs(dir) {
		return dir, nil
	}
	home, err := os.UserHomeDir()
	return filepath.Join(home, ".local", "share"), err
}

func InstalledPath() (string, error) {
	dir, err := dataDir()
	return filepath.Join(dir, "FreeTurnDesktop", "freeturn-desktop"), err
}

func autostartPath() (string, error) {
	dir, err := os.UserConfigDir()
	return filepath.Join(dir, "autostart", "freeturn.desktop"), err
}

// Exec has two escaping layers: desktop-entry values and command arguments.
func desktopEntry(executable string, autostart bool) (string, error) {
	if strings.ContainsAny(executable, "\r\n\x00") || !filepath.IsAbs(executable) {
		return "", errors.New("invalid application path")
	}
	arg := strings.NewReplacer("\\", "\\\\", "\"", "\\\"", "`", "\\`", "$", "\\$", "%", "%%").Replace(executable)
	command := "\"" + arg + "\""
	if autostart {
		command += " --autostart"
	}
	command = strings.ReplaceAll(command, "\\", "\\\\")
	return "[Desktop Entry]\nType=Application\nVersion=1.0\nName=FreeTurn\nComment=VPN and TURN relay client\nExec=" + command + "\nIcon=network-vpn\nTerminal=false\nCategories=Network;\nStartupNotify=true\n", nil
}

func writeEntry(path, executable string, autostart bool) error {
	entry, err := desktopEntry(executable, autostart)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".freeturn-*.desktop")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if err := tmp.Chmod(0o644); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err := tmp.WriteString(entry); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

// Install makes a stable per-user copy. No root, capabilities or shell are used.
func Install() (string, error) {
	target, err := InstalledPath()
	if err != nil {
		return "", err
	}
	executable, err := os.Executable()
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return "", err
	}
	if executable != target {
		if err := copyExecutable(executable, target); err != nil {
			return "", err
		}
	}
	helperSource := filepath.Join(filepath.Dir(executable), "freeturn-vpn-helper")
	helperTarget := filepath.Join(filepath.Dir(target), "freeturn-vpn-helper")
	if helperSource != helperTarget {
		if _, err := os.Stat(helperSource); err == nil {
			if err := copyExecutable(helperSource, helperTarget); err != nil {
				return "", err
			}
		} else if !os.IsNotExist(err) {
			return "", err
		}
	}
	dir, err := dataDir()
	if err != nil {
		return "", err
	}
	if err := writeEntry(filepath.Join(dir, "applications", "freeturn.desktop"), target, false); err != nil {
		return "", err
	}
	return target, nil
}

func copyExecutable(sourcePath, target string) error {
	source, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer source.Close()
	tmp, err := os.CreateTemp(filepath.Dir(target), ".freeturn-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := io.Copy(tmp, source); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Chmod(0o755); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), target)
}

func VPNHelperAvailable() bool { return vpnservice.Available(os.Getuid()) }

func ConfigureVPNHelper(remove bool) error {
	if os.Getuid() <= 0 {
		return errors.New("запустите приложение от обычного пользователя")
	}
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	uid := strconv.Itoa(os.Getuid())
	args := []string{executable, "--remove-vpn-service", uid}
	if !remove {
		helper := filepath.Join(filepath.Dir(executable), "freeturn-vpn-helper")
		if _, err := os.Stat(helper); err != nil {
			return fmt.Errorf("не найден VPN-helper по пути %s: %w; пересоберите приложение через wails build и обновите установленную копию через «Установить / обновить»", helper, err)
		}
		args = []string{executable, "--install-vpn-service", helper, uid}
	}
	out, err := exec.Command("pkexec", args...).CombinedOutput() //nolint:gosec,noctx
	if err != nil {
		return fmt.Errorf("установка системного VPN-helper: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func AutostartEnabled() (bool, error) {
	path, err := autostartPath()
	if err != nil {
		return false, err
	}
	_, err = os.Stat(path)
	if os.IsNotExist(err) {
		return false, nil
	}
	return err == nil, err
}

func SetAutostart(enabled bool) error {
	path, err := autostartPath()
	if err != nil {
		return err
	}
	if !enabled {
		err := os.Remove(path)
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	executable, err := Install()
	if err != nil {
		return err
	}
	return writeEntry(path, executable, true)
}
