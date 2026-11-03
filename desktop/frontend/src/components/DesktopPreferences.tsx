import {useEffect, useState} from 'react'
import {desktop, DesktopSettings} from '../desktop'
import Icon from './Icon'
import UpdatePreferences from './UpdatePreferences'
import {ListServers} from '../../wailsjs/go/main/App'
import {backend} from '../../wailsjs/go/models'

export default function DesktopPreferences({version}: {version: string}) {
  const [settings, setSettings] = useState<DesktopSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [servers, setServers] = useState<backend.Server[]>([])

  const refresh = () => desktop().DesktopSettings().then(setSettings)
  useEffect(() => {
    refresh().catch((e) => setError(String(e)))
    ListServers().then(setServers).catch((e) => setError(String(e)))
  }, [])

  const run = async (action: () => Promise<unknown>, success = '') => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      await refresh()
      setMessage(success)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="settings-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">ПРИЛОЖЕНИЕ</span>
          <h1>Настройки</h1>
        </div>
      </header>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice info" role="status">
          {message}
        </div>
      )}
      {!settings && !error && <p>Загрузка настроек…</p>}
      {settings && (
        <>
          <UpdatePreferences autoCheck={settings.autoCheckUpdates} disabled={busy} canInstall={settings.supported}
            onAutoCheck={(enabled) => run(() => desktop().SetAutoCheckUpdates(enabled))} />
          <div className="settings-card">
            <h2><Icon name="settings" /> Отрисовка интерфейса</h2>
            <label className="field rendering-mode-field">
              <span>Режим рендеринга</span>
              <select
                value={settings.renderingMode}
                disabled={busy || !settings.supported}
                onChange={(e) => run(() => desktop().SetRenderingMode(e.target.value), 'Режим отрисовки сохранён.')}
              >
                <option value="auto">Автоматически — GPU при доступности (по умолчанию)</option>
                <option value="hardware">Предпочитать аппаратное ускорение (GPU)</option>
                <option value="software">Программная отрисовка (CPU)</option>
              </select>
            </label>
            <p className="settings-note">
              В автоматическом режиме WebKit может использовать аппаратное ускорение, если оно доступно для
              содержимого и драйвера. Программный режим отключает его; используйте при артефактах или сбоях GPU.
              Выбранная политика не является проверкой того, какой GPU фактически используется.
            </p>
            <p>
              Режим текущего запуска: <strong>{settings.activeRenderingMode === 'software' ? 'Программный (CPU)'
                : settings.activeRenderingMode === 'hardware' ? 'Предпочитать GPU' : 'Автоматический'}</strong>.
            </p>
            {settings.renderingRestartRequired && (
              <div className="notice info" role="status">
                Для применения сохранённого режима полностью завершите FreeTurn через «Выход» и откройте снова.
                Закрытие окна в трей не считается перезапуском. Если использовался флаг --software-rendering,
                запустите приложение без него, чтобы вернуть выбранный режим.
              </div>
            )}
            <p className="settings-note">Изменение настройки не отключает VPN и не перезапускает приложение автоматически.</p>
          </div>
          <div className="settings-card">
            <h2>
              <Icon name="shield" /> Подключение VPN без пароля
            </h2>
            <p>
              {settings.vpnHelperAvailable
                ? 'Системный helper установлен: новые подключения не требуют пароля.'
                : 'Сейчас при каждом подключении используется pkexec с запросом пароля.'}
            </p>
            <p>
              Один раз подтвердите установку системного компонента. Он получает только права настройки сети, а доступ к
              нему разрешён только вашей учётной записи. Сам интерфейс работает без root.
            </p>
            <button
              className="btn primary"
              disabled={busy || !settings.supported}
              onClick={() => {
                if (
                  window.confirm(
                    'Установить или обновить системный VPN-helper? Потребуется пароль администратора один раз. Ваша учётная запись получит постоянное разрешение на настройку VPN через этот компонент.',
                  )
                ) {
                  run(
                    () => desktop().InstallVPNHelper(),
                    'VPN-helper установлен. Следующее подключение пройдёт без запроса пароля.',
                  )
                }
              }}
            >
              {settings.vpnHelperAvailable ? 'Обновить VPN-helper' : 'Установить VPN-helper'}
            </button>
            {settings.vpnHelperAvailable && (
              <button
                className="btn danger"
                disabled={busy}
                style={{marginLeft: 10}}
                onClick={() => {
                  if (
                    window.confirm(
                      'Удалить доступ к VPN-helper? Активное VPN-соединение будет отключено. Снова потребуется пароль при каждом подключении.',
                    )
                  ) {
                    run(() => desktop().RemoveVPNHelper(), 'Доступ к системному VPN-helper удалён.')
                  }
                }}
              >
                Удалить доступ
              </button>
            )}
          </div>
          <div className="settings-card">
            <h2>
              <Icon name="settings" /> Поведение
            </h2>
            <label className="preference-row">
              <div>
                <strong>Запускать вместе с системой</strong>
                <p>При входе в сеанс Linux. Автоподключение настраивается отдельно ниже.</p>
              </div>
              <input
                type="checkbox"
                role="switch"
                checked={settings.autostart}
                disabled={busy || !settings.supported}
                onChange={(e) => run(() => desktop().SetAutostart(e.target.checked))}
              />
            </label>
            <label className="preference-row">
              <div>
                <strong>Подключаться при запуске</strong>
                <p>Одна попытка при каждом запуске приложения, в том числе вместе с системой.</p>
              </div>
              <input
                type="checkbox"
                role="switch"
                checked={settings.autoConnect}
                disabled={busy || (!servers.length && !settings.autoConnect)}
                onChange={(e) => run(() => desktop().SetAutoConnect(
                  e.target.checked, settings.autoConnectServerId || servers[0]?.id || '',
                ))}
              />
            </label>
            <label className="field autoconnect-profile">
              <span>Профиль автоподключения</span>
              <select
                value={settings.autoConnectServerId}
                disabled={busy || !servers.length}
                onChange={(e) => run(() => desktop().SetAutoConnect(settings.autoConnect, e.target.value))}
              >
                <option value="" disabled>Выберите профиль</option>
                {settings.autoConnectServerId && !servers.some((s) => s.id === settings.autoConnectServerId) && (
                  <option value={settings.autoConnectServerId} disabled>Профиль удалён — выберите другой</option>
                )}
                {servers.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
              </select>
            </label>
            <p className="settings-note">
              Для VPN без запроса пароля установите системный VPN-helper. Капча может потребовать ручного ввода.
              При ошибке повторите подключение вручную.
            </p>
            {settings.autoConnectError && (
              <div className="notice error" role="alert">{settings.autoConnectError}</div>
            )}
            <label className="preference-row">
              <div>
                <strong>Сворачивать в трей при закрытии</strong>
                <p>Закрытие окна не прерывает соединение. Выход — через меню трея.</p>
              </div>
              <input
                type="checkbox"
                role="switch"
                checked={settings.closeToTray}
                disabled={busy || (!settings.trayAvailable && !settings.closeToTray)}
                onChange={(e) => run(() => desktop().SetCloseToTray(e.target.checked))}
              />
            </label>
            {!settings.trayAvailable && (
              <div className="notice info">
                Системный трей недоступен. В GNOME нужно расширение AppIndicator / KStatusNotifierItem. Пока трей
                недоступен, закрытие окна завершает приложение и VPN.
                {settings.trayError && (
                  <details>
                    <summary>Подробности</summary>
                    <p className="mono">{settings.trayError}</p>
                  </details>
                )}
              </div>
            )}
            <button
              className="btn"
              disabled={busy || !settings.trayAvailable}
              onClick={() => run(() => desktop().MinimiseToTray())}
            >
              <Icon name="tray" size={17} /> Свернуть в трей
            </button>
          </div>
          <div className="settings-card">
            <h2>
              <Icon name="download" /> Установка
            </h2>
            <p>
              Установить клиент для текущего пользователя и добавить FreeTurn в меню приложений. Права администратора не
              нужны.
            </p>
            <p className="install-path mono">{settings.installedPath}</p>
            <button
              className="btn primary"
              disabled={busy || !settings.supported}
              onClick={() =>
                run(
                  () => desktop().InstallDesktop(),
                  'FreeTurn установлен. Теперь его можно открыть из меню приложений.',
                )
              }
            >
              {busy ? 'Подождите…' : 'Установить / обновить'}
            </button>
            <p className="settings-note">Ярлык в меню устанавливается с собственной иконкой FreeTurn.</p>
            <button
              className="btn"
              style={{marginTop: 12}}
              disabled={busy || !settings.supported}
              onClick={() =>
                run(
                  () => desktop().CreateDesktopShortcut(),
                  'Ярлык создан на рабочем столе. Если окружение попросит, выберите «Разрешить запуск».',
                )
              }
            >
              <Icon name="plus" size={17} /> Ярлык на рабочий стол
            </button>
            <p className="settings-note">
              Автозапуск также устанавливает стабильную копию клиента — распакованный архив можно перенести или удалить.
            </p>
          </div>
        </>
      )}
      <footer className="settings-about">
        <img className="app-icon" src="/freeturn.svg" alt="" width="44" height="44" />
        <div>
          <strong>FreeTurn для Linux</strong>
          <p>Core {version || '…'} · Wails + React</p>
        </div>
        <button className="btn danger" onClick={() => run(() => desktop().Quit())}>
          Выйти из приложения
        </button>
      </footer>
    </section>
  )
}
