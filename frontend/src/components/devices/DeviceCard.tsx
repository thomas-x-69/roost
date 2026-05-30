import { Link } from 'react-router-dom'
import type { Device } from '../../types/device'
import AsciiDevice from './AsciiDevice'

interface Props {
  device: Device
  to?: string
}

/**
 * DeviceCard — friendly, scannable card for a single device. Used in the
 * Dashboard "recent devices" grid. Display-focused (animated ASCII art, name,
 * status, address); full actions live on the Devices page rows.
 */
export default function DeviceCard({ device: d, to = '/devices' }: Props) {
  const status = d.is_blocked ? 'blocked' : d.is_online ? 'online' : 'offline'
  const statusColor =
    status === 'blocked' ? 'term-danger' : status === 'online' ? 'term-green' : 'term-faint'

  return (
    <Link
      to={to}
      className="rise group block rounded-[10px] border border-term-border bg-term-bg-2 p-4
                 transition-colors duration-150 hover:border-term-border-strong hover:bg-term-bg-3"
    >
      <div className="flex items-start justify-between gap-3">
        <AsciiDevice deviceType={d.device_type} isOnline={d.is_online} isBlocked={d.is_blocked} size="sm" />
        <span className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider ${statusColor}`}>
          <span className={`dot dot-${status} ${status === 'online' ? 'pulse' : ''}`} />
          {status}
        </span>
      </div>

      <div className="mt-3 min-w-0">
        <p className="truncate text-sm text-term-fg group-hover:text-white" title={d.display_name}>
          {d.display_name}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-term-text-dim">
          <span className="text-term-accent">{d.ip_address || '—'}</span>
          <span className="text-term-faint truncate">{d.vendor || 'unknown vendor'}</span>
        </p>
      </div>
    </Link>
  )
}
