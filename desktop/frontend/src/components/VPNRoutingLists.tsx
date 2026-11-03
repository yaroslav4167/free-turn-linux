import {backend} from '../api'

type RouteList = backend.Server['routingLists'][number]

export default function VPNRoutingLists({server, disabled, onChange}: {
  server: backend.Server
  disabled: boolean
  onChange: (server: backend.Server) => void
}) {
  const lists = server.routingLists ?? []
  const setLists = (next: RouteList[]) => onChange({...server, routingLists: next} as backend.Server)
  const patch = (index: number, change: Partial<RouteList>) => setLists(lists.map((list, i) => i === index ? {...list, ...change} as RouteList : list))
  return (
    <section className="field-group vpn-routing-lists">
      <h3>Списки маршрутизации VPN</h3>
      <p className="settings-note">
        Белый список: только указанные адреса через VPN. Чёрный: указанные адреса в обход VPN.
        Белые списки объединяются, чёрные исключения имеют приоритет над белыми.
        Без включённых белых списков используется весь диапазон AllowedIPs профиля.
        Правила действуют только во встроенном VPN, не в режиме реле или отдельном CLI-клиенте.
      </p>
      {lists.map((list, index) => (
        <fieldset className="routing-list" key={index} disabled={disabled}>
          <legend>Список {index + 1}</legend>
          <div className="field-row">
            <div className="field">
              <label htmlFor={`routing-name-${index}`}>Название</label>
              <input id={`routing-name-${index}`} type="text" maxLength={80} value={list.name}
                onChange={(e) => patch(index, {name: e.target.value})} />
            </div>
            <div className="field">
              <label htmlFor={`routing-mode-${index}`}>Режим списка</label>
              <select id={`routing-mode-${index}`} value={list.mode}
                onChange={(e) => patch(index, {mode: e.target.value})}>
                <option value="blacklist">Чёрный — в обход VPN</option>
                <option value="whitelist">Белый — через VPN</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor={`routing-entries-${index}`}>Домены, IP и подсети — по одной записи в строке</label>
            <textarea id={`routing-entries-${index}`} rows={6} spellCheck={false}
              value={(list.entries ?? []).join('\n')}
              placeholder={'example.com\n203.0.113.5\n198.51.100.0/24\n2001:db8::/32'}
              onChange={(e) => patch(index, {entries: e.target.value.split('\n')})} />
          </div>
          <div className="routing-list-actions">
            <label className="checkbox-row">
              <input type="checkbox" checked={list.enabled} onChange={(e) => patch(index, {enabled: e.target.checked})} />
              Использовать список
            </label>
            <button className="btn small danger" onClick={() => setLists(lists.filter((_, i) => i !== index))}>Удалить список</button>
          </div>
        </fieldset>
      ))}
      <button className="btn small" disabled={disabled || lists.length >= 16}
        onClick={() => setLists([...lists, {name: `Список ${lists.length + 1}`, mode: 'blacklist', enabled: true, entries: []} as RouteList])}>
        Добавить список
      </button>
      <div className="notice info">
        Домены разрешаются через системный DNS при подключении; изменение их IP требует переподключения.
        Указывайте точные имена, без https://, путей и *. Поддомены добавляются отдельно.
        Сайты на одном IP могут попадать под одно правило; собственный DNS/DoH браузера может дать другие IP.
        Фильтруются только диапазоны AllowedIPs конфигурации WireGuard: например, при наличии только IPv4 правила не охватывают IPv6.
        DNS-серверы профиля остаются служебными VPN-маршрутами даже при чёрном исключении; адреса VPS/SSH всегда идут напрямую.
        Это маршрутизация, не блокировщик и не защита от утечек.
      </div>
      <p className="settings-note">
        До 16 списков и 256 записей на профиль. Сохраните профиль и переподключитесь для применения.
        {disabled && ' Изменение списков недоступно, пока этот профиль подключён.'}
      </p>
    </section>
  )
}
