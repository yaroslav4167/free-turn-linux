import type {UpdateState} from './desktop'

export type UpdateAction = 'checking' | 'downloading' | 'installing'

const phases: Record<string, {title: string; detail: string}> = {
  checking: {title: 'Проверка обновлений', detail: 'Получаем информацию о последнем стабильном релизе.'},
  confirming: {title: 'Ожидание подтверждения', detail: 'Подтвердите установку или выберите место сохранения в открытом диалоге.'},
  preparing: {title: 'Подготовка обновления', detail: 'Готовим безопасное скачивание архива.'},
  checksum: {title: 'Получение контрольной суммы', detail: 'Загружаем SHA-256 из релиза.'},
  connecting: {title: 'Соединение с сервером', detail: 'Ожидаем ответ сервера загрузки GitHub.'},
  downloading: {title: 'Скачивание обновления', detail: 'VPN продолжает работать до завершения подготовки.'},
  verifying: {title: 'Проверка SHA-256', detail: 'Архив скачан. Проверяем целостность и сохраняем файл.'},
  extracting: {title: 'Распаковка и проверка бинарников', detail: 'Проверяем состав архива и архитектуру. Установленные файлы пока не меняются.'},
  restarting: {title: 'Подготовка перезапуска', detail: 'Сейчас VPN отключится и окно закроется. Установка продолжится отдельно; дождитесь запуска новой версии.'},
}

type ProgressState = Pick<UpdateState, 'busy' | 'phase' | 'received' | 'total' | 'bytesPerSecond' | 'remainingSeconds'>

export function formatUpdateBytes(bytes: number): string {
  let value = Number.isFinite(bytes) ? Math.max(0, bytes) : 0
  const units = ['Б', 'КиБ', 'МиБ', 'ГиБ']
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++ }
  return `${value.toFixed(unit > 0 && value < 10 ? 1 : 0).replace('.', ',')} ${units[unit]}`
}

export function formatUpdateETA(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Время рассчитывается…'
  if (seconds < 60) return `Осталось ≈ ${Math.ceil(seconds)} с`
  if (seconds < 3600) return `Осталось ≈ ${Math.ceil(seconds / 60)} мин`
  return `Осталось ≈ ${Math.ceil(seconds / 3600)} ч`
}

export function updateProgress(state: ProgressState | null, pending: UpdateAction | null) {
  if (!state?.busy && !pending) return null
  const phase = state?.busy ? state.phase || state.busy : pending === 'checking' ? 'checking' : 'confirming'
  const info = phases[phase] || phases.preparing
  const downloading = phase === 'downloading'
  const total = state && Number.isFinite(state.total) ? Math.max(0, state.total) : 0
  const received = state && Number.isFinite(state.received) ? Math.max(0, state.received) : 0
  const percent = downloading && total > 0 ? Math.min(100, Math.floor(received / total * 100)) : null
  const rate = state && Number.isFinite(state.bytesPerSecond) ? Math.max(0, state.bytesPerSecond) : 0
  return {
    phase, ...info, percent,
    transfer: downloading ? `${formatUpdateBytes(Math.min(received, total || received))} из ${total ? formatUpdateBytes(total) : '…'}` : '',
    speed: downloading ? rate > 0 ? `${formatUpdateBytes(rate)}/с` : 'Скорость рассчитывается…' : '',
    eta: downloading ? formatUpdateETA(state?.remainingSeconds ?? -1) : '',
  }
}
