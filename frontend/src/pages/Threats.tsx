import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import client from '../api/client'
import AsciiIcon from '../components/ui/AsciiIcon'

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
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg text-term-fg">
            <span className="text-acc-red">root@roost</span>
            <span className="text-term-text-dim">:~$ </span>
            threats
          </h1>
          <p className="mt-0.5 text-xs text-term-text-dim tabular-nums">
            {stats?.total_entries?.toLocaleString() ?? 0} domains in blocklist
          </p>
        </div>
        <button
          data-testid="update-blocklists-btn"
          onClick={() => updateBlocklists.mutate()}
          disabled={updateBlocklists.isPending}
          className="term-btn"
        >
          <RefreshCw size={14} className={updateBlocklists.isPending ? 'animate-spin' : ''} />
          Update Blocklists
        </button>
      </div>

      {/* Domain checker */}
      <div className="term-panel p-5">
        <div className="mb-3 flex items-center gap-2">
          <AsciiIcon name="search" className="text-acc-red" title="" />
          <span className="panel-title">check a domain</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={checkDomain}
            onChange={e => setCheckDomain(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCheck()}
            placeholder="e.g. doubleclick.net"
            className="flex-1 rounded-[7px] border border-term-border bg-term-bg px-3 py-2 text-sm text-term-fg placeholder-term-faint transition-colors duration-150 focus:outline-none focus:border-acc-red"
          />
          <button
            data-testid="check-domain-btn"
            onClick={handleCheck}
            className="term-btn term-btn-danger"
          >
            <AsciiIcon name="search" title="" /> Check
          </button>
        </div>
        {checkResult && (
          <div
            role="status"
            aria-live="polite"
            data-testid="domain-check-result"
            className={`mt-3 rounded-[7px] border p-3 text-sm ${
              checkResult.is_threat
                ? 'border-term-danger/40 bg-term-danger/10 text-term-danger'
                : 'border-term-green/40 bg-term-green/10 text-term-green'
            }`}
          >
            <strong className="font-mono">{checkResult.domain}</strong>{' '}
            {checkResult.is_threat ? `⚠ Threat detected: ${checkResult.threat_type}` : '✓ Clean'}
          </div>
        )}
      </div>

      {/* Threat list */}
      <div className="term-panel overflow-hidden">
        <div className="panel-head">
          <span className="panel-title flex items-center gap-2">
            <AsciiIcon name="threats" className="text-acc-red" title="" />
            blocked domains
          </span>
        </div>
        {threats.length === 0 ? (
          <div className="p-8 text-center text-sm text-term-text-dim">
            No threats loaded. Click "Update Blocklists" to fetch.
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {threats.slice(0, 50).map((t: any) => (
              <div
                key={t.id}
                className="flex items-center justify-between border-b border-term-border px-5 py-2 transition-colors duration-150 hover:bg-term-bg-3 last:border-b-0"
              >
                <span className="font-mono text-xs text-term-text-dim">{t.domain}</span>
                <span className="text-xs text-acc-red">{t.threat_type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
