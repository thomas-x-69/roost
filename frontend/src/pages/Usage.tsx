import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { getUsageSummary, getTopDevices, getUsageHistory } from '../api/usage'
import { Activity } from 'lucide-react'

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Bandwidth Usage</h1>
        <p className="text-gray-400 text-sm mt-1">Per-device data consumption</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Today', value: formatBytes(summary?.total_bytes_today ?? 0) },
          { label: 'This Week', value: formatBytes(summary?.total_bytes_week ?? 0) },
          { label: 'This Month', value: formatBytes(summary?.total_bytes_month ?? 0) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-gray-400 text-xs mb-1">{label}</div>
            <div className="text-xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Period selector + chart */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white font-medium">
            <Activity size={16} className="text-blue-400" />
            Bandwidth Chart
          </div>
          <div data-testid="period-selector" className="flex gap-1">
            {(['today', '7d', '30d'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>

        <div data-testid="bandwidth-chart" className="h-48">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              No bandwidth data yet — data appears after ~1 minute of traffic capture
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" KB" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#f3f4f6' }}
                />
                <Area type="monotone" dataKey="recv" name="Download" stroke="#3b82f6" fill="#1d4ed8" fillOpacity={0.3} />
                <Area type="monotone" dataKey="sent" name="Upload" stroke="#10b981" fill="#065f46" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top devices table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="px-5 py-3 border-b border-gray-700 text-white font-medium text-sm">
          Top Devices by Usage
        </div>
        {topDevices.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No usage data yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-500 text-xs uppercase">
                <th className="px-5 py-2 text-left">Device</th>
                <th className="px-5 py-2 text-right">Today</th>
                <th className="px-5 py-2 text-right">This Week</th>
              </tr>
            </thead>
            <tbody>
              {topDevices.map(d => (
                <tr
                  key={d.device_id}
                  onClick={() => setSelectedDevice(d.device_id)}
                  className={`border-b border-gray-700 cursor-pointer hover:bg-gray-700/50 ${
                    d.device_id === deviceId ? 'bg-blue-900/20' : ''
                  }`}
                >
                  <td className="px-5 py-3 text-white">{d.display_name}</td>
                  <td className="px-5 py-3 text-right text-gray-300">{formatBytes(d.bytes_today)}</td>
                  <td className="px-5 py-3 text-right text-gray-300">{formatBytes(d.bytes_week)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
