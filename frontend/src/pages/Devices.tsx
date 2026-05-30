import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchDevices } from '../api/devices'
import DeviceTable from '../components/devices/DeviceTable'
import { Search, Wifi, WifiOff } from 'lucide-react'

export default function Devices() {
  const [search, setSearch] = useState('')
  const [onlineOnly, setOnlineOnly] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['devices', { search, onlineOnly }],
    queryFn: () => fetchDevices({ search: search || undefined, online_only: onlineOnly }),
    staleTime: 10_000,
  })

  const devices = data?.devices ?? []
  const total = data?.total ?? 0
  const onlineCount = devices.filter((d) => d.is_online).length

  return (
    <div>
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
