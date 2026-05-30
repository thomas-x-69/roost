import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Device } from '../../types/device'

interface Props {
  devices: Device[]
  gatewayIp?: string
}

/** State colors (muted, no neon). */
const ONLINE = '#4cc38a'
const BLOCKED = '#e0604e'
const OFFLINE = '#5a666d'
const GATEWAY = '#58b2c9'

type NodeState = 'online' | 'blocked' | 'offline'

interface MapNode {
  dev: Device
  x: number
  y: number
  state: NodeState
  color: string
  label: string
}

function deviceState(d: Device): NodeState {
  if (d.is_blocked) return 'blocked'
  if (d.is_online) return 'online'
  return 'offline'
}

function stateColor(s: NodeState): string {
  return s === 'blocked' ? BLOCKED : s === 'online' ? ONLINE : OFFLINE
}

/** Short label: last IP octet if present, else trimmed display name. */
function shortLabel(d: Device): string {
  if (d.ip_address) {
    const parts = d.ip_address.split('.')
    const last = parts[parts.length - 1]
    if (last) return `.${last}`
  }
  const n = d.display_name ?? ''
  return n.length > 8 ? n.slice(0, 7) + '…' : n || '?'
}

export default function NetworkMap({ devices, gatewayIp }: Props) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState<number | null>(null)

  // Logical viewBox; SVG scales to the 320px container.
  const W = 640
  const H = 320
  const CX = W / 2
  const CY = H / 2

  const { gateway, nodes } = useMemo(() => {
    const gw =
      devices.find((d) => (gatewayIp && d.ip_address === gatewayIp)) ??
      devices.find((d) => d.device_type === 'router') ??
      null

    const others = gw ? devices.filter((d) => d.id !== gw.id) : devices

    // Distribute across concentric rings; keep each ring's node count modest.
    const total = others.length
    const perRing = 12
    const ringCount = Math.max(1, Math.ceil(total / perRing))
    // Radii fit within the viewBox with margin for labels.
    const maxR = Math.min(CX, CY) - 44
    const minR = ringCount === 1 ? maxR : 78

    const mapNodes: MapNode[] = []
    let placed = 0
    for (let ring = 0; ring < ringCount; ring++) {
      const remaining = total - placed
      const count = Math.min(perRing, remaining)
      const r =
        ringCount === 1
          ? maxR
          : minR + ((maxR - minR) * ring) / (ringCount - 1)
      // Offset alternating rings so nodes don't line up radially.
      const offset = ring % 2 === 0 ? 0 : Math.PI / count
      for (let i = 0; i < count; i++) {
        const dev = others[placed]
        const angle = (2 * Math.PI * i) / count - Math.PI / 2 + offset
        const state = deviceState(dev)
        mapNodes.push({
          dev,
          x: CX + Math.cos(angle) * r,
          y: CY + Math.sin(angle) * r,
          state,
          color: stateColor(state),
          label: shortLabel(dev),
        })
        placed++
      }
    }
    return { gateway: gw, nodes: mapNodes }
  }, [devices, gatewayIp, CX, CY])

  const goToDevices = () => navigate('/devices')

  // Empty state.
  if (devices.length === 0) {
    return (
      <div
        data-testid="network-map"
        className="flex h-full w-full items-center justify-center bg-term-bg-2"
      >
        <div className="text-center font-mono">
          <div className="text-sm text-term-dim">no devices on the network</div>
          <div className="mt-1 text-xs text-term-faint">
            run a scan to discover devices
          </div>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="network-map" className="relative h-full w-full bg-term-bg-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        role="img"
        aria-label="Network map"
      >
        {/* Edges: gateway -> each device. */}
        <g>
          {nodes.map((n) => {
            const active = hovered === n.dev.id
            const isBlocked = n.state === 'blocked'
            const isOnline = n.state === 'online'
            return (
              <line
                key={`edge-${n.dev.id}`}
                x1={CX}
                y1={CY}
                x2={n.x}
                y2={n.y}
                stroke={isBlocked ? BLOCKED : active ? n.color : '#2a3338'}
                strokeWidth={active ? 1.5 : 1}
                strokeOpacity={active ? 0.9 : isOnline ? 0.55 : 0.3}
                strokeDasharray={isOnline ? undefined : '3 4'}
                style={{ transition: 'stroke 140ms ease, stroke-opacity 140ms ease' }}
              />
            )
          })}
        </g>

        {/* Device nodes. */}
        <g>
          {nodes.map((n) => {
            const active = hovered === n.dev.id
            return (
              <g
                key={`node-${n.dev.id}`}
                transform={`translate(${n.x} ${n.y})`}
                onMouseEnter={() => setHovered(n.dev.id)}
                onMouseLeave={() => setHovered((h) => (h === n.dev.id ? null : h))}
                onClick={goToDevices}
                style={{ cursor: 'pointer' }}
                role="button"
                aria-label={`${n.dev.display_name} ${n.dev.ip_address ?? ''} (${n.state})`}
              >
                {/* Larger transparent hit area. */}
                <circle r={14} fill="transparent" />
                <circle
                  r={active ? 7 : 5}
                  fill="var(--term-bg, #0c0f10)"
                  stroke={n.color}
                  strokeWidth={active ? 2 : 1.5}
                  fillOpacity={n.state === 'offline' ? 0.4 : 0.85}
                  style={{ transition: 'r 140ms ease, stroke-width 140ms ease' }}
                />
                <text
                  y={20}
                  textAnchor="middle"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontSize={9}
                  fill={active ? n.color : '#7c8a91'}
                  style={{ transition: 'fill 140ms ease', pointerEvents: 'none' }}
                >
                  {n.label}
                </text>
              </g>
            )
          })}
        </g>

        {/* Gateway at center. */}
        <g transform={`translate(${CX} ${CY})`}>
          <circle
            r={18}
            fill="var(--term-bg, #0c0f10)"
            stroke={GATEWAY}
            strokeWidth={2}
            strokeOpacity={0.35}
          />
          <circle r={9} fill={GATEWAY} fillOpacity={0.18} stroke={GATEWAY} strokeWidth={1.5} />
          <text
            y={-26}
            textAnchor="middle"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize={10}
            fill={GATEWAY}
          >
            {gateway?.display_name ?? 'gateway'}
          </text>
          {(gateway?.ip_address || gatewayIp) && (
            <text
              y={32}
              textAnchor="middle"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fontSize={9}
              fill="#7c8a91"
            >
              {gateway?.ip_address ?? gatewayIp}
            </text>
          )}
        </g>
      </svg>

      {/* Hover tooltip. */}
      {hovered != null &&
        (() => {
          const n = nodes.find((x) => x.dev.id === hovered)
          if (!n) return null
          return (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-sm border border-term-border bg-term-bg-3 px-2 py-1 font-mono text-xs"
              style={{
                left: `${(n.x / W) * 100}%`,
                top: `${(n.y / H) * 100}%`,
                marginTop: -10,
              }}
            >
              <div className="text-term-fg">{n.dev.display_name}</div>
              <div className="text-term-faint">
                {n.dev.ip_address ?? 'no ip'} · {n.state}
              </div>
            </div>
          )
        })()}

      {/* Legend. */}
      <div className="absolute bottom-2 left-2 flex items-center gap-3 font-mono text-[10px] text-term-faint">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: GATEWAY }} />
          gateway
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: ONLINE }} />
          online
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: BLOCKED }} />
          blocked
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: OFFLINE }} />
          offline
        </span>
      </div>
    </div>
  )
}
