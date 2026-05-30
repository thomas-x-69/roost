import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchDevices } from '../api/devices'
import { systemInfo } from '../api/system'
import NetworkMap from '../components/network-map/NetworkMap'
import DeviceCard from '../components/devices/DeviceCard'
import { useWsStatus } from '../hooks/useWebSocket'

/* A single stat tile — flat, monospace, one accent. No gradients, no icon box. */
function Stat({ label, value, accent, href }: {
  label: string; value: number; accent: string; href?: string
}) {
  const body = (
    <div className="rounded-[10px] border border-term-border bg-term-bg-2 px-4 py-3.5
                    transition-colors duration-150 hover:border-term-border-strong">
      <div className="flex items-center gap-2">
        <span className={`dot ${accent}`} />
        <span className="text-[11px] uppercase tracking-wider text-term-text-dim">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-term-fg">{value}</p>
    </div>
  )
  return href ? <Link to={href} className="block">{body}</Link> : body
}

export default function Dashboard() {
  const { data } = useQuery({
    queryKey: ['devices'],
    queryFn: () => fetchDevices(),
    staleTime: 10_000,
  })
  const { data: netInfo } = useQuery({
    queryKey: ['system-info'], queryFn: systemInfo, staleTime: 60_000,
  })
  const wsStatus = useWsStatus()

  const devices = data?.devices ?? []
  const onlineCount = devices.filter((d) => d.is_online).length
  const blockedCount = devices.filter((d) => d.is_blocked).length
  const protectedCount = devices.filter((d) => d.is_protected).length
  const totalCount = devices.length

  // Most interesting first: blocked, then online, then the rest.
  const recent = [...devices]
    .sort((a, b) =>
      Number(b.is_blocked) - Number(a.is_blocked) || Number(b.is_online) - Number(a.is_online))
    .slice(0, 8)

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header — shell prompt vibe, clean */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg text-term-fg">
            <span className="text-term-green">root@roost</span>
            <span className="text-term-text-dim">:~$ </span>
            overview
          </h1>
          <p className="mt-0.5 text-xs text-term-text-dim">
            {netInfo?.gateway_ip ? `network ${netInfo.gateway_ip}` : 'scanning network…'}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-term-text-dim">
          <span className={`dot ${wsStatus === 'connected' ? 'dot-online pulse' : wsStatus === 'connecting' ? 'dot-offline' : 'dot-blocked'}`} />
          {wsStatus === 'connected' ? 'live' : wsStatus}
        </span>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="online" value={onlineCount} accent="dot-online" href="/devices" />
        <Stat label="total" value={totalCount} accent="dot-offline" href="/devices" />
        <Stat label="blocked" value={blockedCount} accent="dot-blocked" />
        <Stat label="protected" value={protectedCount} accent="dot-online" />
      </div>

      {/* Network map */}
      <div className="term-panel overflow-hidden">
        <div className="panel-head">
          <span className="panel-title">network map</span>
          {netInfo?.gateway_ip && (
            <span className="text-xs text-term-faint">gateway {netInfo.gateway_ip}</span>
          )}
        </div>
        <div style={{ height: 320 }}>
          <NetworkMap devices={devices} gatewayIp={netInfo?.gateway_ip} />
        </div>
      </div>

      {/* Recent devices — friendly card grid */}
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <span className="panel-title">recent devices</span>
          <Link to="/devices" className="text-xs text-term-accent hover:underline">view all →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-term-border bg-term-bg-2 px-5 py-10 text-center">
            <p className="text-sm text-term-text-dim">
              <span className="term-prompt">scanning network</span><span className="blink" />
            </p>
            <p className="mt-1 text-xs text-term-faint">no devices discovered yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {recent.map((d) => <DeviceCard key={d.mac_address} device={d} />)}
          </div>
        )}
      </div>
    </div>
  )
}
