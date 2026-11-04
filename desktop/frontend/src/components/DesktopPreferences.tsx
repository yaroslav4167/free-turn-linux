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
              Капча может потребовать ручного ввода.
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
          <UpdatePreferences autoCheck={settings.autoCheckUpdates} disabled={busy} canInstall={settings.supported}
            onAutoCheck={(enabled) => run(() => desktop().SetAutoCheckUpdates(enabled))} />
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
