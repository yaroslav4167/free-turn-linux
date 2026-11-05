# Release Notes v2.6.5

## Linux desktop UI

* Port shared desktop UI changes from Windows commit `408dd6b4d69dbc61b6faecb9655a86a87ba5d457` while preserving Linux installation, autostart, tray guidance and VPN implementation.
* Show captcha, update and connection error notifications in a centered overlay above the interface without shifting page content. Long notices scroll and their actions remain clickable.
* Preserve settings state when switching pages, keep the profile list current and pause frequent update polling while settings are hidden.
* Compact the connection screen in short windows and ignore stale connection results after cancellation.
* Carry notification, settings navigation and layout regression checks to Linux.

---

# Release Notes v1.0.3

## Что нового в версии v1.0.3

### 🛠️ Исправление установки ядра на VPS (Server Control & Upload Fallback)
* **Надежное определение релизов ядра**: устранена ошибка 404 при установке `server-linux-amd64` на сервере. Скрипт `server-control` теперь корректно разрешает версию бинарника и имеет автоматический fallback на стабильный релиз `v3.4.1` в случае непредвиденных ответов GitHub.
* **Локальный фоллбек загрузки бинарника**: исправлены адреса репозитория (`purkalolka/free-turn-proxy`) в модуле `upload.go`. Если VPS не может скачать бинарник напрямую из-за ограничений сети хостинга, клиентский компьютер автоматически загружает исполняемый файл и заливает его на VPS по SSH без сбоев разрешения тега.
* **Скрипт установки `install.sh`**: актуализированы пути репозиториев на `purkalolka/free-turn-proxy`.

---

# Release Notes v1.0.2

## Что нового в версии v1.0.2

### 🛡️ Безопасность и ядро (free-turn-proxy v3.4.1)
* **VK Calls без капчи**: официальный мобильный `client_id=8093730` с поддержкой `token` и `user_token` для вызовов `auth.getAnonymToken` и `messages.getAnonymCallToken`, гарантирующий получение TURN-учетных данных без запроса капчи.
* **DTLS Certificate Pinning**: защита от MITM через проверку SHA-256 отпечатка сертификата (параметр `fp` в ссылках `freeturn://` и CLI-флаг `-dtls-fingerprint`), постоянные самоподписанные сертификаты сервера.
* **Anti-Replay Window**: скользящее окно размером 128 пакетов (RFC 6479 / RFC 4303) в протоколах обфускации RTP Opus (`rtpopus`, `rtpopus2`, `rtpopus3`), пресекающее атаки повтора пакетов.
* **Защита конфигураций**: безопасные права доступа `0600` (`-rw-------`) для файлов конфигурации, паролей и ключей.
* **Server-Control**: скрипты настройки VPS переключены на защищенный репозиторий `purkalolka/free-turn-proxy`, добавлена retry-логика при скачивании бинарников, сверка SHA-256 и надежное управление блокировками пакетных менеджеров.

### 📦 Артефакты сборки
* **FreeTurn-Windows-Portable-v1.0.2.zip**: Портативный клиент для Windows (GUI на базе Wails v2 + WinTUN драйвер `wintun.dll` + `Run_Admin.bat`).
* **client-windows-amd64.exe / server-windows-amd64.exe**: CLI бинарники ядра Free Turn Proxy.
* **checksums.txt**: SHA-256 контрольные суммы всех файлов.
