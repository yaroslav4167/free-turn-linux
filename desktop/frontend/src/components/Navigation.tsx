import Icon, {IconName} from './Icon'

export type View = 'connect' | 'servers' | 'logs' | 'settings'

const items: {id: View; label: string; icon: IconName}[] = [
  {id: 'connect', label: 'Подключение', icon: 'power'},
  {id: 'servers', label: 'Серверы', icon: 'servers'},
  {id: 'logs', label: 'Журнал', icon: 'logs'},
  {id: 'settings', label: 'Настройки', icon: 'settings'},
]

export default function Navigation({
  view,
  onChange,
  version,
}: {
  view: View
  onChange: (view: View) => void
  version: string
}) {
  return (
    <aside className="navigation">
      <div className="brand" aria-label="FreeTurn" title="FreeTurn">
        <span className="brand-mark">
          <Icon name="shield" size={23} />
        </span>
      </div>
      <nav aria-label="Главное меню">
        {items.map((item) => (
          <button
            key={item.id}
            className={'nav-item' + (view === item.id ? ' active' : '')}
            aria-current={view === item.id ? 'page' : undefined}
            aria-label={item.label}
            title={item.label}
            onClick={() => onChange(item.id)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="nav-footer" title={`FreeTurn Core ${version || '…'}`}>
        <small>LINUX</small>
      </div>
    </aside>
  )
}
