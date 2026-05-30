import { useQuery } from '@tanstack/react-query'
import { fetchDevices } from '../api/devices'
import { systemInfo } from '../api/system'
import { Monitor, Wifi, ShieldOff, AlertTriangle, TrendingUp } from 'lucide-react'
import NetworkMap from '../components/network-map/NetworkMap'
import { Link } from 'react-router-dom'

interface StatCardProps {
  label: string
  value: number
  icon: React.ReactNode
  gradient: string
  href?: string
}

function StatCard({ label, value, icon, gradient, href }: StatCardProps) {
  const content = (
    <div
      className="relative overflow-hidden rounded-xl p-5 transition-transform hover:scale-[1.01] cursor-default"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {/* Gradient background glow */}
      <div className={`absolute inset-0 opacity-[0.06] ${gradient}`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${gradient} bg-opacity-20`}>
          {icon}
        </div>
      </div>
    </div>
  )
  return href ? <Link to={href} className="block">{content}</Link> : content
}

export default function Dashboard() {
  const { data } = useQuery({
    queryKey: ['devices'],
    queryFn: () => fetchDevices(),
    staleTime: 10_000,
    // No polling — WebSocket events invalidate this query in real-time
  })

  const { data: netInfo } = useQuery({
    queryKey: ['system-info'],
    queryFn: systemInfo,
    staleTime: 60_000,
  })

  const devices = data?.devices ?? []
  const onlineCount  = devices.filter((d) => d.is_online).length
  const blockedCount = devices.filter((d) => d.is_blocked).length
  const totalCount   = devices.length
  const protectedCount = devices.filter((d) => d.is_protected).length

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Online"
          value={onlineCount}
          icon={<Wifi size={20} className="text-emerald-400" />}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          href="/devices"
        />
        <StatCard
          label="Total Devices"
          value={totalCount}
          icon={<Monitor size={20} className="text-blue-400" />}
          gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          href="/devices"
        />
        <StatCard
          label="Blocked"
          value={blockedCount}
          icon={<ShieldOff size={20} className="text-rose-400" />}
          gradient="bg-gradient-to-br from-rose-500 to-red-600"
        />
        <StatCard
          label="Protected"
          value={protectedCount}
          icon={<AlertTriangle size={20} className="text-amber-400" />}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
        />
      </div>

      {/* Network Map */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-400" />
            <span className="text-sm font-semibold text-white">Network Map</span>
          </div>
          {netInfo?.gateway_ip && (
            <span className="text-xs text-slate-500">Gateway: {netInfo.gateway_ip}</span>
          )}
        </div>
        <div style={{ height: 320 }}>
          <NetworkMap devices={devices} gatewayIp={netInfo?.gateway_ip} />
        </div>
      </div>

      {/* Recent Devices */}
      <div className="rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <span className="text-sm font-semibold text-white">Recent Devices</span>
          <Link to="/devices" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            View all →
          </Link>
        </div>
        <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as any}>
          {devices.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No devices discovered yet.</p>
          )}
          {devices.slice(0, 6).map((d) => (
            <div key={d.mac_address} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  d.is_blocked ? 'bg-red-400' : d.is_online ? 'bg-emerald-400 pulse' : 'bg-slate-600'
                }`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{d.display_name}</p>
                  <p className="text-xs text-slate-500 font-mono">{d.ip_address}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <span className="text-xs text-slate-500 hidden sm:block">{d.vendor || '—'}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  d.is_blocked
                    ? 'bg-red-500/15 text-red-400'
                    : d.is_online
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-slate-700/50 text-slate-500'
                }`}>
                  {d.is_blocked ? 'Blocked' : d.is_online ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
