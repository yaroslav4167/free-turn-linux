import {useEffect, useState} from 'react'
import {desktop, UpdateState} from '../desktop'
import Icon from './Icon'
import InfoTip from './InfoTip'
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
    <div className="settings-card updates-card">
      <h2>
        <Icon name="download" /> Обновления
      </h2>
      <div className="update-summary">
        <span>Версия: <strong>{state?.currentVersion || '…'}</strong></span>
        <InfoTip label="Об источнике обновлений">
          {state?.repository ? `Источник: github.com/${state.repository}. Только стабильные релизы; ключи и профили не передаются.`
            : 'Репозиторий обновлений не задан при сборке. Для локальной сборки задайте UPDATE_REPOSITORY.'}
          {state && !state.currentKnown && <p>Тестовая сборка: сравнение версий недоступно.</p>}
          {state?.checkedAt && <p>Проверено: {new Date(state.checkedAt).toLocaleString()}</p>}
        </InfoTip>
        {state?.checkedAt && <span>{state.available ? `Доступна ${state.latestVersion}` : 'Обновлений нет'}</span>}
      </div>
      <div className="preference-row">
        <div className="update-summary">
          <label htmlFor="auto-check-updates"><strong>Автопроверка</strong></label>
          <InfoTip label="О расписании автопроверки">Через 10 секунд после запуска, затем каждые 6 часов через публичный GitHub API.</InfoTip>
        </div>
        <input
          id="auto-check-updates"
          type="checkbox"
          role="switch"
          checked={autoCheck}
          disabled={disabled || !state?.repository}
          onChange={(e) => onAutoCheck(e.target.checked)}
        />
      </div>
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
    </div>
  )
}
