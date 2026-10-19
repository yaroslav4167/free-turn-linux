//go:build linux

package notify

import (
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"time"
)

const throttleWindow = 5 * time.Second

var captchaMu sync.Mutex
var lastCaptchaTime time.Time

// ShowCaptchaNotification alerts the user while the captcha URL remains
// available from the app's own captcha event and button.
func ShowCaptchaNotification(captchaURL string, onOpen func()) error {
	captchaMu.Lock()
	if time.Since(lastCaptchaTime) < throttleWindow {
		captchaMu.Unlock()
		return nil
	}
	lastCaptchaTime = time.Now()
	captchaMu.Unlock()

	if onOpen != nil {
		go onOpen()
	}
	return ShowNotification("FreeTurn: требуется решение капчи VK",
		"Откройте FreeTurn и нажмите «Открыть captcha в браузере».", captchaURL)
}

// ShowNotification uses the freedesktop notification service via notify-send.
// The URL is included as plain text since actions are not portable across
// desktop notification implementations.
func ShowNotification(title, message, url string) error {
	if u := strings.TrimSpace(url); u != "" {
		message += "\n" + u
	}
	cmd := exec.Command("notify-send", "--app-name=FreeTurn", title, message) //nolint:gosec,noctx
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("desktop notification: %w", err)
	}
	return nil
}
