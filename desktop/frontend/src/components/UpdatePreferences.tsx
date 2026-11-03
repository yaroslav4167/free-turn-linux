import {useEffect, useState} from 'react'
import {desktop, UpdateState} from '../desktop'
import Icon from './Icon'

function useUpdateState(interval: number) {
  const [state, setState] = useState<UpdateState | null>(null)
  useEffect(() => {
    let active = true
    const refresh = () => desktop().UpdateState()
      .then((next) => { if (active) setState(next) })
      .catch(() => {})
    refresh()
    const timer = window.setInterval(refresh, interval)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [interval])
  return state
}

export function UpdateNotice({onOpen}: {onOpen: () => void}) {
  const state = useUpdateState(10000)
  if (!state?.available) return null
  return (
    <div className="notice info app-error" role="status">
      <span>{state.currentKnown ? 'Доступно обновление' : 'Доступен стабильный релиз'} FreeTurn {state.latestVersion}.</span>
      <button className="btn small" onClick={onOpen}>
        Открыть настройки
      </button>
    </div>
  )
}

export default function UpdatePreferences({autoCheck, onAutoCheck, disabled, canInstall}: {
  autoCheck: boolean
  onAutoCheck: (enabled: boolean) => void
  disabled: boolean
  canInstall: boolean
}) {
  const state = useUpdateState(1000)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const run = async (action: () => Promise<void>) => {
    setPending(true)
    setError('')
    try {
      await action()
    } catch (e) {
      setError(String(e))
    } finally {
      setPending(false)
    }
  }
  const busy = pending || !!state?.busy
  return (
    <div className="settings-card">
      <h2>
        <Icon name="download" /> Обновления
      </h2>
      <p>Версия приложения: <strong>{state?.currentVersion || '…'}</strong></p>
      {state && !state.currentKnown && (
        <p className="settings-note">
          Тестовая сборка: версия не задана, сравнение с релизом недоступно. Стабильный релиз можно скачать вручную.
        </p>
      )}
      <label className="preference-row">
        <div>
          <strong>Проверять обновления автоматически</strong>
          <p>Через 10 секунд после запуска и затем каждые 6 часов. Проверка обращается к публичному GitHub API.</p>
        </div>
        <input
          type="checkbox"
          role="switch"
          checked={autoCheck}
          disabled={disabled || !state?.repository}
          onChange={(e) => onAutoCheck(e.target.checked)}
        />
      </label>
      <p className="settings-note">
        {state?.repository
          ? `Источник: github.com/${state.repository}, только стабильные Releases, не сборки Actions. Ключи и профили не передаются.`
          : 'Репозиторий обновлений не задан при сборке. В Actions он берётся из github.repository; для локальной сборки задайте UPDATE_REPOSITORY.'}
      </p>
      {state?.checkedAt && (
        <p>
          Проверено: {new Date(state.checkedAt).toLocaleString()} · {state.available
            ? `Доступна версия ${state.latestVersion}` : 'У вас актуальная или более новая версия'}
        </p>
      )}
      {(error || state?.error) && (
        <div className="notice error" role="alert">{error || state?.error}</div>
      )}
      <div className="inline-actions update-actions">
        <button className="btn" disabled={busy || !state?.repository} onClick={() => run(() => desktop().CheckForUpdates())}>
          {state?.busy === 'checking' ? 'Проверка…' : 'Проверить обновления'}
        </button>
        {state?.available && (
          <button className="btn primary" disabled={busy || !canInstall} onClick={() => run(() => desktop().InstallUpdate())}>
            {state.busy === 'preparing' ? 'Подготовка обновления…' : 'Скачать и установить'}
          </button>
        )}
        {state?.available && (
          <button className="btn primary" disabled={busy} onClick={() => run(() => desktop().DownloadUpdate())}>
            <Icon name="download" size={17} /> {state.busy === 'downloading' ? 'Скачивание…' : `Скачать ${state.latestVersion}`}
          </button>
        )}
      </div>
      {(state?.busy === 'downloading' || state?.busy === 'preparing') && state.total > 0 && (
        <p role="status">
          Скачано {Math.min(100, Math.round(state.received / state.total * 100))}%
          <progress className="update-progress" aria-label="Скачивание обновления" max={state.total} value={state.received} />
        </p>
      )}
      {state?.downloadedPath && (
        <div className="notice info" role="status">
          Архив проверен по SHA-256 и сохранён: <span className="mono update-path">{state.downloadedPath}</span>
        </div>
      )}
      {state?.installationMessage && (
        <div className="notice info" role="status">
          {state.installationMessage}
          {state.backupPath && <p className="mono update-path">Резервная копия: {state.backupPath}</p>}
        </div>
      )}
      <p className="settings-note">
        «Скачать и установить» запрашивает подтверждение, проверяет архив, отключает VPN и перезапускает клиент.
        Бинарники устанавливаются в пользовательский каталог без sudo, с резервной копией для отката.
        Отдельная кнопка «Скачать» только сохраняет архив в выбранное место.
        Системный VPN-helper обновляется отдельно с подтверждением администратора. Установки без подтверждения нет.
      </p>
    </div>
  )
}
