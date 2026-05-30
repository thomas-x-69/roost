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
    if (diffMin < 1)  return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24)   return `${diffH}h ago`
    return d.toLocaleDateString()
  } catch {
    return '—'
  }
}

export default function DeviceRow({ device }: Props) {
  const statusLabel = device.is_blocked ? 'BLOCKED' : device.is_online ? 'ONLINE' : 'OFFLINE'
  const statusColor = device.is_blocked
    ? 'term-danger'
    : device.is_online
    ? 'term-green'
    : 'term-dim'

  return (
    <tr
      data-testid="device-row"
      className="transition-colors hover:bg-term-green/[0.04]"
      style={{ borderBottom: '1px solid var(--term-dim)' }}
    >
      {/* Device identity + animated ASCII art */}
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <DeviceIcon
              iconKey={device.icon_key}
              deviceType={device.device_type}
              isOnline={device.is_online}
              isBlocked={device.is_blocked}
              size="sm"
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-term-fg term-glow truncate max-w-[160px]">
              {device.display_name}
            </div>
            <div className="text-xs term-dim truncate max-w-[160px]">
              {device.vendor || 'unknown vendor'}
            </div>
          </div>
        </div>
      </td>

      {/* IP / MAC */}
      <td className="px-4 py-3 align-middle">
        <div>
          <span data-testid="device-ip" className="block text-sm term-accent">
            {device.ip_address || '—'}
          </span>
          <span data-testid="device-mac" className="block text-[11px] term-dim mt-0.5">
            {device.mac_address}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3 align-middle">
        <span
          data-testid={device.is_blocked ? 'status-badge-blocked' : 'status-badge'}
          className={`inline-flex items-center gap-2 text-xs font-medium tracking-wider ${statusColor}`}
        >
          <span
            className={`w-1.5 h-1.5 ${
              device.is_blocked
                ? 'bg-term-danger animate-blink'
                : device.is_online
                ? 'bg-term-green pulse'
                : 'bg-term-dim'
            }`}
          />
          {statusLabel}
        </span>
      </td>

      {/* Last seen */}
      <td className="px-4 py-3 align-middle">
        <span className="text-xs term-dim">{formatTime(device.last_seen)}</span>
      </td>

      {/* Block / Unblock */}
      <td className="px-4 py-3 align-middle">
        <BlockButton
          deviceId={device.id}
          isBlocked={device.is_blocked}
          isProtected={device.is_protected}
        />
      </td>

      {/* Bandwidth limit */}
      <td className="px-4 py-3 align-middle">
        <BandwidthSlider
          deviceId={device.id}
          currentLimit={device.bandwidth_limit_kbps}
        />
      </td>
    </tr>
  )
}
