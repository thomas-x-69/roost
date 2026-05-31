import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchDevices } from '../api/devices'
import client from '../api/client'
import DeviceTable from '../components/devices/DeviceTable'
import { Search, Wifi, WifiOff, AlertTriangle, ShieldCheck, X } from 'lucide-react'

interface BlockingDiagnostics {
  is_admin: boolean
  npcap_available: boolean
  interface: string
  interface_display: string
  own_ip: string
  own_mac: string
  gateway_ip: string
  gateway_mac: string | null
  can_block: boolean
  reasons: string[]
}

export default function Devices() {
  const [search, setSearch] = useState('')
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['devices', { search, onlineOnly }],
    queryFn: () => fetchDevices({ search: search || undefined, online_only: onlineOnly }),
    staleTime: 10_000,
  })

  const { data: diagnostics } = useQuery<BlockingDiagnostics>({
    queryKey: ['diagnostics', 'blocking'],
    queryFn: async () => {
      const { data } = await client.get('/diagnostics/blocking')
      return data
    },
    staleTime: 30_000,
  })

  const devices = data?.devices ?? []
  const total = data?.total ?? 0
  const onlineCount = devices.filter((d) => d.is_online).length

  return (
    <div>
      {/* Blocking diagnostics banner — surfaces silent ARP-block failures */}
      {diagnostics && !bannerDismissed && (
        diagnostics.can_block ? (
          <div
            data-testid="blocking-diagnostics-ready"
            className="flex items-center gap-2 mb-4 text-xs text-green-400"
          >
            <ShieldCheck size={14} />
            <span>Blocking ready</span>
          </div>
        ) : (
          <div
            data-testid="blocking-diagnostics-warning"
            className="flex items-start justify-between gap-3 mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-600 text-red-300"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-semibold text-red-300">
                  Blocking unavailable
                </p>
                <p className="text-xs text-red-300/90 mt-1">
                  {diagnostics.reasons.join(' · ')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss"
              className="shrink-0 text-red-400 hover:text-red-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )
      )}

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Devices</h1>
          <p className="text-gray-400 text-sm mt-1">
            {onlineCount} online · {total} total
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={() => setOnlineOnly(!onlineOnly)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
            onlineOnly
              ? 'bg-green-900/30 border-green-600 text-green-400'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          {onlineOnly ? <Wifi size={14} /> : <WifiOff size={14} />}
          Online only
        </button>
      </div>

      {/* Table */}
      <DeviceTable devices={devices} loading={isLoading} />
    </div>
  )
}
