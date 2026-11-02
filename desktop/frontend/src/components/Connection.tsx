import {backend, BrowserOpenURL} from '../api'
import Icon from './Icon'
import TrafficSparkline from './TrafficSparkline'
import type {TrafficHistory} from '../trafficHistory'
import {connectionState} from '../connectionState'

function rate(value: number): string {
  if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + ' МБ/с'
  if (value >= 1024) return (value / 1024).toFixed(1) + ' КБ/с'
  return Math.max(0, value).toFixed(0) + ' Б/с'
}

function bytes(value: number): string {
  if (value >= 1024 * 1024 * 1024) return (value / (1024 * 1024 * 1024)).toFixed(2) + ' ГБ'
  if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + ' МБ'
  if (value >= 1024) return (value / 1024).toFixed(1) + ' КБ'
  return Math.max(0, value).toFixed(0) + ' Б'
}

interface Props {
  servers: backend.Server[]
  selected: backend.Server | null
  status: backend.Status
  captchaUrl: string
  pending: boolean
  trafficHistory: TrafficHistory
  onSelect: (id: string) => void
  onConnect: () => void
  onDisconnect: () => void
  onAdd: () => void
  onEdit: () => void
}

export default function Connection({
  servers,
  selected,
  status,
  captchaUrl,
  pending,
  trafficHistory,
  onSelect,
  onConnect,
  onDisconnect,
  onAdd,
  onEdit,
}: Props) {
  const active = !['idle', 'error'].includes(status.state)
  const activeServer = servers.find((s) => s.id === status.serverId)
  const vpn = (active ? activeServer : selected)?.connMode === 'vpn'
  const presentation = connectionState(status.state, pending, vpn)
  const connected = presentation.connected
  return (
    <section className="connection-page">
      <header className="page-heading">
        <div className="connection-brand">
          <h1>FreeTurn</h1>
          <span>Личное соединение</span>
        </div>
        <button className="btn icon-button" onClick={onAdd} aria-label="Добавить сервер" title="Добавить сервер">
          <Icon name="plus" size={22} />
        </button>
      </header>
      <div className={'connection-center ' + presentation.visualState}>
        <span className={'mode-badge' + (connected ? ' is-connected' : '')}>
          {connected ? <span className="connection-indicator" aria-hidden="true" /> : <Icon name="shield" size={14} />}
          {connected ? 'Соединение активно' : vpn ? 'VPN · весь трафик' : 'TURN · режим реле'}
        </span>
        <button
          className={'power-button' + (active ? ' is-active' : '')}
          onClick={active ? onDisconnect : onConnect}
          disabled={(!selected && !active) || (pending && !active)}
          aria-label={presentation.ariaLabel}
          aria-busy={presentation.busy}
          aria-pressed={connected}
        >
          <svg className="power-progress" viewBox="0 0 150 150" aria-hidden="true" focusable="false">
            <rect
              className="power-progress-path"
              x="1"
              y="1"
              width="148"
              height="148"
              rx="43"
              pathLength={1}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <Icon name={connected ? 'stop' : 'power'} size={connected ? 40 : 48} />
          <span className="power-action">{presentation.action}</span>
        </button>
        <h2 aria-live="polite">{presentation.heading}</h2>
        <p>
          {active
            ? activeServer?.name || activeServer?.peer || 'Соединение активно'
            : selected
              ? 'Нажмите, чтобы подключиться к выбранному серверу'
              : 'Добавьте первый сервер, чтобы начать'}
        </p>
        {active && !connected && (
          <button className="btn ghost small" onClick={onDisconnect}>
            Отменить подключение
          </button>
        )}
        {status.state === 'captcha' && captchaUrl && (
          <button className="btn primary" onClick={() => BrowserOpenURL(captchaUrl)}>
            Открыть проверку в браузере
          </button>
        )}
        {status.state === 'error' && status.errMsg && (
          <div className="notice error connection-error">{status.errMsg}</div>
        )}
        {connected && !vpn && (
          <p className="relay-hint">
            Endpoint внешнего WireGuard-клиента: <span className="mono">{activeServer?.listen}</span>
          </p>
        )}
      </div>
      <div className="connection-bottom">
        <div className="traffic-grid">
          <div className="traffic-card">
            <TrafficSparkline values={trafficHistory.rx} direction="rx" />
            <span>
              <Icon name="download" size={17} /> Получено
            </span>
            <strong>{rate(connected ? status.rxRate : 0)}</strong>
            <small className="muted">Всего: {bytes(status.rxTotal)}</small>
          </div>
          <div className="traffic-card">
            <TrafficSparkline values={trafficHistory.tx} direction="tx" />
            <span>
              <Icon name="upload" size={17} /> Отправлено
            </span>
            <strong>{rate(connected ? status.txRate : 0)}</strong>
            <small className="muted">Всего: {bytes(status.txTotal)}</small>
          </div>
          <div className="traffic-card">
            <span>
              <Icon name="servers" size={17} /> Потоки
            </span>
            <strong>{active ? `${status.streams} / ${status.total}` : '—'}</strong>
          </div>
        </div>
        <div className="profile-picker">
          <Icon name="servers" size={20} />
          <div className="field">
            <label htmlFor="active-profile" className="sr-only">
              Сервер подключения
            </label>
            <select
              id="active-profile"
              value={selected?.id ?? ''}
              onChange={(e) => onSelect(e.target.value)}
              disabled={servers.length === 0}
            >
              {servers.length === 0 && <option value="">Нет серверов</option>}
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || s.peer || 'Без имени'}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn icon-button"
            disabled={!selected}
            onClick={onEdit}
            aria-label="Настроить выбранный сервер"
            title="Настроить сервер"
          >
            <Icon name="settings" size={18} />
          </button>
        </div>
      </div>
    </section>
  )
}
