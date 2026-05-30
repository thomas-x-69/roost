import type { Device } from '../../types/device'
import DeviceIcon from './DeviceIcon'
import BlockButton from './BlockButton'
import BandwidthSlider from './BandwidthSlider'

interface Props {
  device: Device
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1)  return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24)   return `${diffH}h ago`
    return d.toLocaleDateString()
  } catch {
    return '—'
  }
}

export default function DeviceRow({ device }: Props) {
  return (
    <tr
      data-testid="device-row"
      className="transition-colors hover:bg-white/[0.025]"
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      {/* Device identity */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <DeviceIcon iconKey={device.icon_key} size="sm" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate max-w-[160px]">{device.display_name}</div>
            <div className="text-xs text-slate-500 truncate max-w-[160px]">{device.vendor || 'Unknown vendor'}</div>
          </div>
        </div>
      </td>

      {/* IP / MAC */}
      <td className="px-4 py-3">
        <div>
          <span data-testid="device-ip" className="block text-sm text-slate-300 font-mono">
            {device.ip_address || '—'}
          </span>
          <span data-testid="device-mac" className="block text-[11px] text-slate-600 font-mono mt-0.5">
            {device.mac_address}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span
          data-testid={device.is_blocked ? 'status-badge-blocked' : 'status-badge'}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            device.is_blocked
              ? 'bg-red-500/15 text-red-400 border border-red-500/20'
              : device.is_online
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-700/50 text-slate-500 border border-slate-600/20'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${
            device.is_blocked ? 'bg-red-400' : device.is_online ? 'bg-emerald-400 pulse' : 'bg-slate-500'
          }`} />
          {device.is_blocked ? 'Blocked' : device.is_online ? 'Online' : 'Offline'}
        </span>
      </td>

      {/* Last seen */}
      <td className="px-4 py-3">
        <span className="text-xs text-slate-500">{formatTime(device.last_seen)}</span>
      </td>

      {/* Block / Unblock */}
      <td className="px-4 py-3">
        <BlockButton
          deviceId={device.id}
          isBlocked={device.is_blocked}
          isProtected={device.is_protected}
        />
      </td>

      {/* Bandwidth limit */}
      <td className="px-4 py-3">
        <BandwidthSlider
          deviceId={device.id}
          currentLimit={device.bandwidth_limit_kbps}
        />
      </td>
    </tr>
  )
}
