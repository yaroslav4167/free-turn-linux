import {useEffect, useState} from 'react'
import {desktop, UpdateState} from '../desktop'
import Icon from './Icon'
import {readDismissedUpdate, saveDismissedUpdate, updateNoticeId} from '../updateNotice'
import {updateProgress, UpdateAction} from '../updateProgress'

function useUpdateState(interval: number) {
  const [state, setState] = useState<UpdateState | null>(null)
  useEffect(() => {
    let active = true
    let timer: number | undefined
    const refresh = async () => {
      try {
        const next = await desktop().UpdateState()
        if (active) setState(next)
      } catch {
        // The local bridge can disappear while the application restarts.
      } finally {
        if (active) timer = window.setTimeout(refresh, interval)
      }
    }
    refresh()
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [interval])
  return state
}

export function UpdateNotice({onOpen}: {onOpen: () => void}) {
  const state = useUpdateState(10000)
  const [dismissed, setDismissed] = useState(() => readDismissedUpdate())
  if (!state?.available || dismissed === updateNoticeId(state)) return null
  const dismiss = () => {
    const id = updateNoticeId(state)
    setDismissed(id)
    saveDismissedUpdate(id)
  }
  return (
    <div className="notice info app-error" role="status">
      <span>{state.currentKnown ? 'Доступно обновление' : 'Доступен стабильный релиз'} FreeTurn {state.latestVersion}.</span>
      <div className="inline-actions update-notice-actions">
        <button className="btn small" onClick={onOpen}>
          Открыть настройки
        </button>
        <button className="btn small ghost" onClick={dismiss}
          aria-label="Скрыть уведомление об обновлении" title="Скрыть уведомление об этой версии">
          ×
        </button>
      </div>
    </div>
  )
}

export default function UpdatePreferences({autoCheck, onAutoCheck, disabled, canInstall}: {
  autoCheck: boolean
  onAutoCheck: (enabled: boolean) => void
  disabled: boolean
  canInstall: boolean
}) {
  const state = useUpdateState(500)
  const [pending, setPending] = useState<UpdateAction | null>(null)
  const [error, setError] = useState('')
  const run = async (operation: UpdateAction, action: () => Promise<void>) => {
    setPending(operation)
    setError('')
    try {
      await action()
    } catch (e) {
      setError(String(e))
    } finally {
      setPending(null)
    }
  }
  const busy = pending !== null || !!state?.busy
  const progress = updateProgress(state, pending)
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
      {(error || (!busy && state?.error)) && (
        <div className="notice error" role="alert">{error || state?.error}</div>
      )}
      <div className="inline-actions update-actions">
        <button className="btn" disabled={busy || !state?.repository} onClick={() => run('checking', () => desktop().CheckForUpdates())}>
          {state?.busy === 'checking' ? 'Проверка…' : 'Проверить обновления'}
        </button>
        {state?.available && (
          <button className="btn primary" disabled={busy || !canInstall} onClick={() => run('installing', () => desktop().InstallUpdate())}>
            {pending === 'installing' || state.busy === 'preparing' || state.busy === 'restarting' ? 'Подготовка обновления…' : 'Скачать и установить'}
          </button>
        )}
        {state?.available && (
          <button className="btn primary" disabled={busy} onClick={() => run('downloading', () => desktop().DownloadUpdate())}>
            <Icon name="download" size={17} /> {state.busy === 'downloading' ? 'Скачивание…' : `Скачать ${state.latestVersion}`}
          </button>
        )}
      </div>
      {progress && (
        <section className="update-task" aria-label="Ход обновления" aria-busy="true">
          <div className="update-task-heading">
            <strong role="status">{progress.title}</strong>
            {progress.percent !== null && <span className="mono">{progress.percent}%</span>}
          </div>
          <progress className="update-progress" aria-label={progress.title} max={100} value={progress.percent ?? undefined} />
          {progress.transfer && (
            <div className="update-task-stats">
              <span>{progress.transfer}</span>
              <span>{progress.speed}</span>
              <span>{progress.eta}</span>
            </div>
          )}
          <p className="settings-note">{progress.detail}</p>
        </section>
      )}
      {state?.downloadedPath && !busy && (
        <div className="notice info" role="status">
          Архив проверен по SHA-256 и сохранён: <span className="mono update-path">{state.downloadedPath}</span>
        </div>
      )}
      {state?.installationMessage && !busy && (
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
