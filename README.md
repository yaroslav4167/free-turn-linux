# FreeTurn for Linux

Графический клиент [free-turn-proxy](https://github.com/purkalolka/free-turn-proxy) для Linux на Go, Wails 2 и React. Клиент поддерживает реле для внешнего WireGuard/AmneziaWG и встроенный VPN одной кнопкой.

## Поддерживаемые системы

- Ubuntu 22.04+ и Debian 12+ с WebKit2GTK 4.1.
- Arch Linux и совместимые дистрибутивы с WebKit2GTK 4.1.

Готовый архив релиза содержит клиент `freeturn-desktop`, консольные `client` и `server`, а также `freeturn.desktop`. После распаковки запустите `./freeturn-desktop`. Для пункта в меню установите клиент в каталог из `PATH` и скопируйте `freeturn.desktop` в `~/.local/share/applications/`.

Для работы окна нужны GTK3 и WebKit2GTK 4.1. Для уведомлений о капче используется `notify-send` (`libnotify-bin` в Debian/Ubuntu, `libnotify` в Arch).

В режиме VPN нужны `/dev/net/tun`, `ip` из `iproute2`, `pkexec` с работающим Polkit-агентом и `systemd-resolved` для настройки DNS из WireGuard-конфига. Приложение остаётся запущенным от обычного пользователя. После подтверждения Polkit оно запускает отдельный привилегированный процесс для создания TUN и настройки сети.

### Зависимости для запуска

Ubuntu/Debian:

```sh
sudo apt install libgtk-3-0 libwebkit2gtk-4.1-0 iproute2 polkitd systemd-resolved libnotify-bin
```

Arch:

```sh
sudo pacman -S gtk3 webkit2gtk-4.1 iproute2 polkit systemd libnotify
```

Проверьте, что служба `systemd-resolved` работает, если в конфиге WireGuard заданы DNS-серверы. На дистрибутивах с другим DNS-менеджером режим реле работает без этого требования; встроенный VPN сообщит об ошибке настройки DNS и вернёт сетевые маршруты.

## Подключение

1. Добавьте сервер по ссылке `freeturn://` или настройте свой VPS через мастер в приложении.
2. Если у профиля есть WireGuard-конфиг, выберите «VPN (одна кнопка)» и нажмите «Включить VPN». Polkit запросит права на настройку сети.
3. В режиме «Реле» запустите подключение в FreeTurn и направьте внешний WireGuard/AmneziaWG-клиент на указанный локальный порт.

Встроенный VPN запускает реле на обычном интернет-соединении и добавляет маршруты через TUN только после установки соединения. При отключении и при неожиданном завершении окна привилегированный процесс снимает маршруты и DNS с созданного интерфейса. Закрытие окна завершает приложение и VPN.

## Сборка

Требуются Go 1.26+, Node.js 18+, npm, C-компилятор, заголовки GTK3 и WebKit2GTK 4.1. На Ubuntu/Debian установите `libgtk-3-dev libwebkit2gtk-4.1-dev`; на Arch используйте `gtk3 webkit2gtk-4.1 base-devel`.

```sh
go install github.com/wailsapp/wails/v2/cmd/wails@v2.16.0
npm --prefix desktop/frontend ci
cd desktop
wails build -tags webkit2_41 -ldflags "-checklinkname=0 -s -w" -trimpath
```

Исполняемый файл появится в `desktop/build/bin/freeturn-desktop`. Для разработки используйте `wails dev -tags webkit2_41`. Команда `task build` собирает консольные `client` и `server` в `dist/`.

Go-модуль намеренно сохраняет имя `github.com/samosvalishe/free-turn-proxy`, чтобы не менять импорты ядра и существующие инструменты. Источник Linux-клиента отделён от [Windows-клиента](https://github.com/purkalolka/free-turn-windows); серверная часть и протокол совместимы.
