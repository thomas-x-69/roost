import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert, Search, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import client from '../api/client'

const fetchThreats = async () => {
  const { data } = await client.get('/threats')
  return data
}

const fetchStats = async () => {
  const { data } = await client.get('/threats/stats')
  return data
}

export default function Threats() {
  const [checkDomain, setCheckDomain] = useState('')
  const [checkResult, setCheckResult] = useState<any>(null)

  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: ['threats'], queryFn: fetchThreats, refetchInterval: 60000 })
  const { data: stats } = useQuery({ queryKey: ['threat-stats'], queryFn: fetchStats })
  const threats = data?.threats ?? []

  const updateBlocklists = useMutation({
    mutationFn: async () => {
      const { data } = await client.post('/threats/blocklists/update')
      return data
    },
    onSuccess: () => {
      toast.info('Blocklist update started — this runs in the background and may take a minute.')
      // Refresh once the import has had time to populate.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['threats'] })
        queryClient.invalidateQueries({ queryKey: ['threat-stats'] })
      }, 8000)
    },
    onError: () => toast.error('Failed to start blocklist update'),
  })

  const handleCheck = async () => {
    if (!checkDomain) return
    try {
      const { data } = await client.post('/threats/check', { domain: checkDomain })
      setCheckResult(data)
    } catch {
      setCheckResult(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Threats</h1>
          <p className="text-gray-400 text-sm mt-1">
            {stats?.total_entries?.toLocaleString() ?? 0} domains in blocklist
          </p>
        </div>
        <button
          data-testid="update-blocklists-btn"
          onClick={() => updateBlocklists.mutate()}
          disabled={updateBlocklists.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-lg text-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={updateBlocklists.isPending ? 'animate-spin' : ''} />
          Update Blocklists
        </button>
      </div>

      {/* Domain checker */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="text-sm font-medium text-white mb-3">Check a Domain</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={checkDomain}
            onChange={e => setCheckDomain(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCheck()}
            placeholder="e.g. doubleclick.net"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            data-testid="check-domain-btn"
            onClick={handleCheck}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
          >
            <Search size={14} /> Check
          </button>
        </div>
        {checkResult && (
          <div role="status" aria-live="polite" data-testid="domain-check-result" className={`mt-3 p-3 rounded-lg text-sm ${checkResult.is_threat ? 'bg-red-900/40 border border-red-800 text-red-300' : 'bg-green-900/40 border border-green-800 text-green-300'}`}>
            <strong>{checkResult.domain}</strong>{' '}
            {checkResult.is_threat ? `⚠ Threat detected: ${checkResult.threat_type}` : '✓ Clean'}
          </div>
        )}
      </div>

      {/* Threat list */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="px-5 py-3 border-b border-gray-700 text-sm font-medium text-white flex items-center gap-2">
          <ShieldAlert size={14} className="text-red-400" />
          Blocked Domains
        </div>
        {threats.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No threats loaded. Click "Update Blocklists" to fetch.
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {threats.slice(0, 50).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-2 border-b border-gray-700 hover:bg-gray-700/50">
                <span className="text-xs font-mono text-gray-300">{t.domain}</span>
                <span className="text-xs text-red-400">{t.threat_type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
