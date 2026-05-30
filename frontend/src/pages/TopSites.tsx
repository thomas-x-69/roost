import { useQuery } from '@tanstack/react-query'
import { getTopSites } from '../api/usage'
import { ShieldAlert, Globe } from 'lucide-react'

export default function TopSites() {
  const { data: sites = [], isLoading } = useQuery({
    queryKey: ['top-sites'],
    queryFn: getTopSites,
    refetchInterval: 60000,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Top Sites</h1>
        <p className="text-gray-400 text-sm mt-1">DNS queries captured from your network</p>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
        ) : sites.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No DNS data yet — DNS queries appear after traffic capture starts
          </div>
        ) : (
          <table data-testid="top-sites-table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-500 text-xs uppercase">
                <th className="px-5 py-3 text-left">Domain</th>
                <th className="px-5 py-3 text-right">Queries</th>
                <th className="px-5 py-3 text-right">Devices</th>
                <th className="px-5 py-3 text-center">Threat</th>
              </tr>
            </thead>
            <tbody>
              {sites.map(site => (
                <tr
                  key={site.domain}
                  data-testid="domain-row"
                  className="border-b border-gray-700 hover:bg-gray-700/50"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {site.is_threat ? (
                        <ShieldAlert size={14} className="text-red-400 shrink-0" />
                      ) : (
                        <Globe size={14} className="text-gray-500 shrink-0" />
                      )}
                      <span className={`font-mono text-xs ${site.is_threat ? 'text-red-400' : 'text-gray-300'}`}>
                        {site.domain}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-300">{site.query_count.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-gray-400">{site.device_count}</td>
                  <td className="px-5 py-3 text-center">
                    {site.is_threat ? (
                      <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full border border-red-800">
                        {site.threat_type ?? 'Threat'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
