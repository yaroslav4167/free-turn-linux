import {ReactNode} from 'react'

export default function InfoTip({label, children}: {label: string, children: ReactNode}) {
  return <details className="info-tip">
    <summary aria-label={label} title={label}>ⓘ</summary>
    <div className="info-tip-content">{children}</div>
  </details>
}
