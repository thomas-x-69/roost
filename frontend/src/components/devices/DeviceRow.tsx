import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Device } from '../../types/device'
import { updateDevice } from '../../api/devices'
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
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(device.custom_name ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) { inputRef.current?.focus(); inputRef.current?.select() }
  }, [editing])

  const rename = useMutation({
    mutationFn: (custom_name: string) => updateDevice(device.id, { custom_name }),
    onSuccess: (res) => {
      // Update every ['devices', ...] query in place, then refetch to be safe.
      queryClient.setQueriesData({ queryKey: ['devices'] }, (old: any) => {
        if (!old?.devices) return old
        return { ...old, devices: old.devices.map((d: Device) => d.id === device.id ? res.device : d) }
      })
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      toast.success('Device renamed')
      setEditing(false)
    },
    onError: () => toast.error('Rename failed'),
  })

  const startEdit = () => { setName(device.custom_name ?? ''); setEditing(true) }
  const save = () => {
    const next = name.trim()
    if (next === (device.custom_name ?? '')) { setEditing(false); return }
    rename.mutate(next)
  }

  const statusLabel = device.is_blocked ? 'BLOCKED' : device.is_online ? 'ONLINE' : 'OFFLINE'
  const statusColor = device.is_blocked ? 'term-danger' : device.is_online ? 'term-green' : 'term-dim'

  return (
    <tr
      data-testid="device-row"
      className="transition-colors hover:bg-term-green/[0.04]"
      style={{ borderBottom: '1px solid var(--term-border)' }}
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
            {editing ? (
              <input
                ref={inputRef}
                data-testid="rename-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save()
                  else if (e.key === 'Escape') setEditing(false)
                }}
                placeholder={device.hostname || device.vendor || 'device name'}
                className="w-[170px] rounded-[6px] border border-acc-green/50 bg-term-bg px-2 py-1 text-sm text-term-fg focus:outline-none"
              />
            ) : (
              <button
                type="button"
                data-testid="device-name"
                onClick={startEdit}
                title="Click to rename"
                className="group flex max-w-[170px] items-center gap-1.5 text-left"
              >
                <span className="truncate text-sm font-medium text-term-fg group-hover:text-white">
                  {device.display_name}
                </span>
                <span className="text-xs text-term-faint opacity-0 transition-opacity group-hover:opacity-100">✎</span>
              </button>
            )}
            <div className="max-w-[170px] truncate text-xs term-dim">
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
          <span data-testid="device-mac" className="mt-0.5 block text-[11px] term-dim">
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
            className={`h-1.5 w-1.5 rounded-full ${
              device.is_blocked ? 'bg-term-danger animate-blink'
              : device.is_online ? 'bg-term-green pulse'
              : 'bg-term-faint'
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
        <BlockButton deviceId={device.id} isBlocked={device.is_blocked} isProtected={device.is_protected} />
      </td>

      {/* Bandwidth limit */}
      <td className="px-4 py-3 align-middle">
        <BandwidthSlider deviceId={device.id} currentLimit={device.bandwidth_limit_kbps} />
      </td>
    </tr>
  )
}
