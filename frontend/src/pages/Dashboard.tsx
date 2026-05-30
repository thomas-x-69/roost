import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchDevices } from '../api/devices'
import { systemInfo } from '../api/system'
import { listSchedules } from '../api/schedules'
import { getUsageSummary, getTopSites } from '../api/usage'
import client from '../api/client'
import NetworkMap from '../components/network-map/NetworkMap'
import DeviceCard from '../components/devices/DeviceCard'
import AsciiIcon, { type AsciiIconName } from '../components/ui/AsciiIcon'
import { getPageAccent } from '../theme/pageAccents'
import { useWsStatus } from '../hooks/useWebSocket'

/** Human-friendly byte formatter for the usage widget. */
function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes ?? 0} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`
}

/* A compact per-page widget card: accent-tinted, ASCII icon, live stat, links. */
function Widget({ to, icon, label, value, hint }: {
  to: string; icon: AsciiIconName; label: string; value: string; hint?: string
}) {
  const accent = getPageAccent(to)
  return (
    <Link
      to={to}
      data-testid={`widget-${label}`}
      style={{ ['--w-accent' as string]: accent.hex }}
      className="group block rounded-[10px] border border-term-border bg-term-bg-2 px-3.5 py-3
                 transition-colors duration-150 hover:border-[var(--w-accent)]"
    >
      <div className="flex items-center gap-2">
        <AsciiIcon name={icon} title="" color={accent.hex} className="text-sm" />
        <span className="text-[10px] uppercase tracking-wider text-term-text-dim">{label}</span>
      </div>
      <p
        className="mt-1.5 truncate text-xl font-semibold tabular-nums"
        style={{ color: accent.hex }}
        title={value}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-[10px] text-term-faint">{hint}</p>}
    </Link>
  )
}

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

  // Lightweight per-widget reads. Each reuses an existing query key so the data
  // is shared with its page, and gracefully tolerates missing/empty responses.
  const { data: schedulesData } = useQuery({
    queryKey: ['schedules'], queryFn: listSchedules, staleTime: 30_000,
  })
  const { data: groupsData } = useQuery({
    queryKey: ['groups'], queryFn: async () => (await client.get('/groups')).data, staleTime: 30_000,
  })
  const { data: alertsData } = useQuery({
    queryKey: ['alerts'], queryFn: async () => (await client.get('/alerts?limit=100')).data, staleTime: 30_000,
  })
  const { data: threatStats } = useQuery({
    queryKey: ['threat-stats'], queryFn: async () => (await client.get('/threats/stats')).data, staleTime: 60_000,
  })
  const { data: usageSummary } = useQuery({
    queryKey: ['usage-summary'], queryFn: getUsageSummary, staleTime: 30_000,
  })
  const { data: topSites } = useQuery({
    queryKey: ['top-sites'], queryFn: getTopSites, staleTime: 60_000,
  })
  const { data: reportsData } = useQuery({
    queryKey: ['reports'], queryFn: async () => (await client.get('/reports')).data, staleTime: 60_000,
  })

  const wsStatus = useWsStatus()

  const devices = data?.devices ?? []
  const onlineCount = devices.filter((d) => d.is_online).length
  const blockedCount = devices.filter((d) => d.is_blocked).length
  const protectedCount = devices.filter((d) => d.is_protected).length
  const totalCount = devices.length

  // Per-widget live stats, all defensively defaulted.
  const schedules = schedulesData?.schedules ?? []
  const activeSchedules = schedules.filter((s: any) => s.is_active).length
  const groupCount = (groupsData?.groups ?? []).length
  const alertCount = (alertsData?.alerts ?? []).length
  const blockedDomains = threatStats?.total_entries ?? 0
  const bandwidthToday = usageSummary?.total_bytes_today ?? 0
  const topDomain = topSites?.[0]?.domain ?? '—'
  const reports = reportsData?.reports ?? []
  const lastReport = reports[0]
  const lastReportLabel = lastReport
    ? (lastReport.period ?? lastReport.filename ?? 'ready')
    : 'none yet'

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

      {/* Per-page widgets — one per page, each in its own accent color */}
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <AsciiIcon name="dashboard" title="" className="text-term-faint text-sm" />
          <span className="panel-title">// modules</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Widget to="/devices"   icon="devices"   label="devices"   value={`${onlineCount} online`} hint={`${totalCount} known`} />
          <Widget to="/usage"     icon="usage"     label="usage"     value={formatBytes(bandwidthToday)} hint="today" />
          <Widget to="/top-sites" icon="top-sites" label="top site"  value={topDomain} hint="most queried" />
          <Widget to="/schedules" icon="schedules" label="schedules" value={`${activeSchedules} active`} hint={`${schedules.length} total`} />
          <Widget to="/alerts"    icon="alerts"    label="alerts"    value={`${alertCount}`} hint="recent" />
          <Widget to="/threats"   icon="threats"   label="threats"   value={blockedDomains.toLocaleString()} hint="domains blocked" />
          <Widget to="/groups"    icon="groups"    label="groups"    value={`${groupCount}`} hint="defined" />
          <Widget to="/reports"   icon="reports"   label="reports"   value={lastReportLabel} hint="last report" />
        </div>
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
