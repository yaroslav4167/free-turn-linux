const labels: Record<string, string> = {
  idle: 'Отключено',
  connecting: 'Подключение…',
  captcha: 'Требуется проверка',
  error: 'Не удалось подключиться',
}

export function connectionState(state: string, pending: boolean, vpn: boolean) {
  const active = state !== 'idle' && state !== 'error'
  const connected = state === 'connected' && !pending
  const visualState = pending && state !== 'captcha' && state !== 'error' ? 'connecting' : state
  return {
    active,
    connected,
    visualState,
    busy: visualState === 'connecting',
    heading: connected ? (vpn ? 'VPN включён' : 'Реле запущено') : (labels[visualState] ?? visualState),
    action: connected ? 'Отключить' : active ? 'Отменить' : 'Подключить',
    ariaLabel: connected
      ? vpn
        ? 'Отключить VPN'
        : 'Остановить реле'
      : active
        ? 'Отменить подключение'
        : 'Подключиться',
  }
}
