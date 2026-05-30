import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import client from '../api/client'
import AsciiIcon from '../components/ui/AsciiIcon'

const fetchThreats = async () => (await client.get('/threats')).data
const fetchStats = async () => (await client.get('/threats/stats')).data
const fetchBlocked = async () => (await client.get('/threats/blocked')).data

export default function Threats() {
  const [checkDomain, setCheckDomain] = useState('')
  const [checkResult, setCheckResult] = useState<any>(null)
  const [blockInput, setBlockInput] = useState('')

  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: ['threats'], queryFn: fetchThreats, refetchInterval: 60000 })
  const { data: stats } = useQuery({ queryKey: ['threat-stats'], queryFn: fetchStats })
  const { data: blockedData } = useQuery({ queryKey: ['blocked-domains'], queryFn: fetchBlocked })
  const threats = data?.threats ?? []
  const blocked: string[] = blockedData?.blocked_domains ?? []

  const updateBlocklists = useMutation({
    mutationFn: async () => (await client.post('/threats/blocklists/update')).data,
    onSuccess: () => {
      toast.info('Blocklist update started — runs in the background, may take a minute.')
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['threats'] })
        queryClient.invalidateQueries({ queryKey: ['threat-stats'] })
      }, 8000)
    },
    onError: () => toast.error('Failed to start blocklist update'),
  })

  // Manually block a domain (sinkhole via hosts file on THIS machine).
  const blockDomain = useMutation({
    mutationFn: async (domain: string) => (await client.post('/threats/block', { domain })).data,
    onSuccess: (res) => {
      if (res?.blocked) {
        toast.success(`Blocked ${res.domain} on this machine`)
        setBlockInput('')
        queryClient.invalidateQueries({ queryKey: ['blocked-domains'] })
      } else {
        toast.error(`Couldn't block ${res?.domain ?? 'domain'} — run Roost as Administrator, or check the domain is valid.`)
      }
    },
    onError: () => toast.error('Block request failed'),
  })

  const unblockDomain = useMutation({
    mutationFn: async (domain: string) => (await client.post('/threats/unblock', { domain })).data,
    onSuccess: (res) => {
      toast.success(`Unblocked ${res?.domain ?? ''}`)
      queryClient.invalidateQueries({ queryKey: ['blocked-domains'] })
    },
    onError: () => toast.error('Unblock request failed'),
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

  const submitBlock = () => {
    const d = blockInput.trim().toLowerCase()
    if (d) blockDomain.mutate(d)
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
            {stats?.total_entries?.toLocaleString() ?? 0} domains in detection list · {blocked.length} blocked here
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

      {/* Manually block a domain */}
      <div className="term-panel p-5">
        <div className="mb-1 flex items-center gap-2">
          <AsciiIcon name="block" className="text-acc-red" title="" />
          <span className="panel-title">block a domain</span>
        </div>
        <p className="mb-3 text-xs text-term-faint">
          Sinkholes the domain on <span className="text-term-text-dim">this machine</span> via the hosts
          file (needs Administrator). Does not affect other devices on the network.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            data-testid="block-domain-input"
            value={blockInput}
            onChange={(e) => setBlockInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitBlock()}
            placeholder="e.g. ads.example.com"
            className="flex-1 rounded-[7px] border border-term-border bg-term-bg px-3 py-2 text-sm text-term-fg placeholder-term-faint transition-colors duration-150 focus:outline-none focus:border-acc-red"
          />
          <button
            data-testid="block-domain-btn"
            onClick={submitBlock}
            disabled={blockDomain.isPending || !blockInput.trim()}
            className="term-btn term-btn-danger"
          >
            <AsciiIcon name="block" title="" /> Block
          </button>
        </div>
      </div>

      {/* Blocked on this machine */}
      <div className="term-panel overflow-hidden">
        <div className="panel-head">
          <span className="panel-title flex items-center gap-2">
            <AsciiIcon name="blocked" className="text-acc-red" title="" />
            blocked on this machine
          </span>
          <span className="text-xs text-term-faint tabular-nums">{blocked.length}</span>
        </div>
        {blocked.length === 0 ? (
          <div className="p-6 text-center text-sm text-term-text-dim">
            Nothing blocked here yet. Add a domain above to sinkhole it on this machine.
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto" data-testid="blocked-domains-list">
            {blocked.map((d) => (
              <div
                key={d}
                className="flex items-center justify-between border-b border-term-border px-5 py-2 transition-colors duration-150 hover:bg-term-bg-3 last:border-b-0"
              >
                <span className="font-mono text-xs text-term-fg">{d}</span>
                <button
                  data-testid={`unblock-${d}`}
                  onClick={() => unblockDomain.mutate(d)}
                  disabled={unblockDomain.isPending}
                  className="term-btn px-2 py-0.5 text-[11px]"
                  title="Unblock"
                >
                  <AsciiIcon name="unblock" title="" /> unblock
                </button>
              </div>
            ))}
          </div>
        )}
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
            onChange={(e) => setCheckDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
            placeholder="e.g. doubleclick.net"
            className="flex-1 rounded-[7px] border border-term-border bg-term-bg px-3 py-2 text-sm text-term-fg placeholder-term-faint transition-colors duration-150 focus:outline-none focus:border-acc-red"
          />
          <button data-testid="check-domain-btn" onClick={handleCheck} className="term-btn">
            <AsciiIcon name="search" title="" /> Check
          </button>
        </div>
        {checkResult && (
          <div
            role="status"
            aria-live="polite"
            data-testid="domain-check-result"
            className={`mt-3 flex items-center justify-between gap-3 rounded-[7px] border p-3 text-sm ${
              checkResult.is_threat
                ? 'border-term-danger/40 bg-term-danger/10 text-term-danger'
                : 'border-term-green/40 bg-term-green/10 text-term-green'
            }`}
          >
            <span>
              <strong className="font-mono">{checkResult.domain}</strong>{' '}
              {checkResult.is_threat ? `⚠ Threat: ${checkResult.threat_type}` : '✓ Clean'}
            </span>
            <button
              onClick={() => blockDomain.mutate(String(checkResult.domain).toLowerCase())}
              disabled={blockDomain.isPending}
              className="term-btn term-btn-danger px-2 py-0.5 text-[11px]"
            >
              <AsciiIcon name="block" title="" /> block here
            </button>
          </div>
        )}
      </div>

      {/* Detection blocklist (read-only reference) */}
      <div className="term-panel overflow-hidden">
        <div className="panel-head">
          <span className="panel-title flex items-center gap-2">
            <AsciiIcon name="threats" className="text-acc-red" title="" />
            detection blocklist
          </span>
          <span className="text-xs text-term-faint tabular-nums">
            {stats?.total_entries?.toLocaleString() ?? threats.length} domains · reference
          </span>
        </div>
        {threats.length === 0 ? (
          <div className="p-8 text-center text-sm text-term-text-dim">
            No detection entries loaded. Click "Update Blocklists" to fetch the StevenBlack list.
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
            {threats.length > 50 && (
              <div className="px-5 py-2 text-center text-[11px] text-term-faint">
                showing first 50 of {(stats?.total_entries ?? threats.length).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
