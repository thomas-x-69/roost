import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import { getUsageSummary, getTopDevices, getUsageHistory } from '../api/usage'
import AsciiIcon from '../components/ui/AsciiIcon'

const ACCENT = 'var(--acc-cyan)'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

type Period = 'today' | '7d' | '30d'

export default function Usage() {
  const [period, setPeriod] = useState<Period>('today')
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null)

  const { data: summary } = useQuery({
    queryKey: ['usage-summary'],
    queryFn: getUsageSummary,
    refetchInterval: 60000,
  })

  const { data: topDevices = [] } = useQuery({
    queryKey: ['top-devices'],
    queryFn: getTopDevices,
    refetchInterval: 60000,
  })

  const deviceId = selectedDevice ?? (topDevices[0]?.device_id ?? null)

  const { data: history = [] } = useQuery({
    queryKey: ['usage-history', deviceId, period],
    queryFn: () => deviceId ? getUsageHistory(deviceId, period) : Promise.resolve([]),
    enabled: deviceId !== null,
    refetchInterval: 60000,
  })

  const chartData = history.map(h => ({
    time: new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    sent: Math.round(h.bytes_sent / 1024),
    recv: Math.round(h.bytes_recv / 1024),
  }))

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AsciiIcon name="usage" color={ACCENT} className="text-xl" />
        <div>
          <h1 className="text-lg text-term-fg">
            <span style={{ color: ACCENT }}>usage</span>
            <span className="text-term-text-dim">:~$ </span>
            bandwidth
          </h1>
          <p className="mt-0.5 text-xs text-term-text-dim">per-device data consumption</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'today', value: formatBytes(summary?.total_bytes_today ?? 0) },
          { label: 'this week', value: formatBytes(summary?.total_bytes_week ?? 0) },
          { label: 'this month', value: formatBytes(summary?.total_bytes_month ?? 0) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-[10px] border border-term-border bg-term-bg-2 px-4 py-3.5
                       transition-colors duration-150 hover:border-term-border-strong"
          >
            <div className="flex items-center gap-2">
              <span className="dot" style={{ background: ACCENT }} />
              <span className="text-[11px] uppercase tracking-wider text-term-text-dim">{label}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-term-fg">{value}</p>
          </div>
        ))}
      </div>

      {/* Period selector + chart */}
      <div className="term-panel overflow-hidden">
        <div className="panel-head">
          <span className="panel-title flex items-center gap-2">
            <AsciiIcon name="usage" color={ACCENT} />
            bandwidth chart
          </span>
          <div data-testid="period-selector" className="flex gap-1.5">
            {(['today', '7d', '30d'] as Period[]).map(p => {
              const active = period === p
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="term-btn"
                  style={active
                    ? { color: ACCENT, borderColor: ACCENT, background: 'rgba(88,178,201,.12)' }
                    : undefined}
                >
                  {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : '30 Days'}
                </button>
              )
            })}
          </div>
        </div>

        <div data-testid="bandwidth-chart" className="h-56 p-4">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-term-faint">
              <span className="term-prompt">no bandwidth data yet — appears after ~1 minute of traffic capture</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="usage-recv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#58b2c9" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#58b2c9" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="usage-sent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4cc38a" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#4cc38a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#222b30" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#5a666d', fontSize: 11, fontFamily: 'var(--term-font)' }}
                  stroke="#222b30"
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#5a666d', fontSize: 11, fontFamily: 'var(--term-font)' }}
                  stroke="#222b30"
                  tickLine={false}
                  unit=" KB"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#12171a',
                    border: '1px solid #2f3a40',
                    borderRadius: 8,
                    fontFamily: 'var(--term-font)',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#e6edf1' }}
                  itemStyle={{ color: '#93a4ac' }}
                  cursor={{ stroke: '#2f3a40' }}
                />
                <Area type="monotone" dataKey="recv" name="Download" stroke="#58b2c9" strokeWidth={1.5} fill="url(#usage-recv)" />
                <Area type="monotone" dataKey="sent" name="Upload" stroke="#4cc38a" strokeWidth={1.5} fill="url(#usage-sent)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top devices table */}
      <div className="term-panel overflow-hidden">
        <div className="panel-head">
          <span className="panel-title">top devices by usage</span>
        </div>
        {topDevices.length === 0 ? (
          <div className="p-8 text-center text-sm text-term-faint">
            <span className="term-prompt">no usage data yet</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-term-border text-[11px] uppercase tracking-wider text-term-faint">
                <th className="px-5 py-2.5 text-left font-medium">Device</th>
                <th className="px-5 py-2.5 text-right font-medium">Today</th>
                <th className="px-5 py-2.5 text-right font-medium">This Week</th>
              </tr>
            </thead>
            <tbody>
              {topDevices.map(d => {
                const active = d.device_id === deviceId
                return (
                  <tr
                    key={d.device_id}
                    onClick={() => setSelectedDevice(d.device_id)}
                    className="cursor-pointer border-b border-term-border transition-colors duration-150 last:border-0 hover:bg-term-bg-3"
                    style={active ? { background: 'rgba(88,178,201,.08)' } : undefined}
                  >
                    <td className="px-5 py-3 text-term-fg">
                      <span className="flex items-center gap-2">
                        {active && <span className="dot" style={{ background: ACCENT }} />}
                        {d.display_name}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-term-text-dim">{formatBytes(d.bytes_today)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-term-text-dim">{formatBytes(d.bytes_week)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
