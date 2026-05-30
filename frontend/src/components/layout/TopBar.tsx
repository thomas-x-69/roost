import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { triggerScan } from '../../api/devices'
import { toast } from 'sonner'
import { useLocation } from 'react-router-dom'
import { useWsStatus } from '../../hooks/useWebSocket'

const PAGE_TITLES: Record<string, string> = {
  '/':          'dashboard',
  '/devices':   'devices',
  '/groups':    'groups',
  '/schedules': 'schedules',
  '/usage':     'usage',
  '/top-sites': 'top-sites',
  '/threats':   'threats',
  '/alerts':    'alerts',
  '/reports':   'reports',
}

async function fetchAlertCount() {
  const r = await fetch('/api/v1/alerts/count')
  if (!r.ok) return { unread_count: 0 }
  return r.json()
}

export default function TopBar() {
  const queryClient = useQueryClient()
  const [scanning, setScanning] = useState(false)
  const location = useLocation()
  const wsStatus = useWsStatus()
  const segment = PAGE_TITLES[location.pathname] ?? 'roost'

  const { data: countData } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: fetchAlertCount,
    refetchInterval: 30_000,
  })
  const unread = countData?.unread_count ?? 0

  const wsState =
    wsStatus === 'connected'  ? { cls: 'term-green', txt: 'ONLINE' } :
    wsStatus === 'connecting' ? { cls: 'term-amber', txt: 'CONNECTING' } :
                                { cls: 'term-danger', txt: 'OFFLINE' }

  const scanMutation = useMutation({
    mutationFn: triggerScan,
    onSuccess: () => {
      toast.info('Network scan started…')
      setScanning(true)
      setTimeout(async () => {
        setScanning(false)
        await queryClient.invalidateQueries({ queryKey: ['devices'] })
        toast.success('Scan complete')
      }, 5000)
    },
    onError: () => toast.error('Scan failed'),
  })

  return (
    <header
      className="fixed top-0 right-0 flex items-center justify-between px-6 z-10 bg-term-bg/90"
      style={{
        left: 'var(--sidebar-width)',
        height: 'var(--topbar-height)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--term-dim)',
      }}
    >
      {/* Shell prompt path */}
      <h2 className="text-sm flex items-center gap-1">
        <span className="term-dim">root@roost</span>
        <span className="term-dim">:</span>
        <span className="term-accent term-glow-cyan">/{segment}</span>
        <span className="term-green">$</span>
        <span className="blink" />
      </h2>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* Connection status line */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className={`w-2 h-2 ${wsState.cls.replace('term-', 'bg-term-')} ${wsStatus === 'connected' ? 'pulse' : ''}`} />
          <span className={`uppercase tracking-wide ${wsState.cls}`}>{wsState.txt}</span>
        </div>

        {/* Alert link */}
        <a href="/alerts" className="relative text-sm term-dim hover:text-term-fg transition-colors">
          alerts
          {unread > 0 && (
            <span className="ml-1 term-danger term-glow-amber">
              [{unread > 9 ? '9+' : unread}]
            </span>
          )}
        </a>

        {/* Scan button */}
        <button
          data-testid="scan-button"
          onClick={() => scanMutation.mutate()}
          disabled={scanning || scanMutation.isPending}
          className="term-btn term-btn-amber flex items-center gap-1.5 text-sm"
        >
          <RefreshCw size={13} className={scanning ? 'animate-spin' : ''} />
          {scanning ? 'scanning' : 'scan-now'}
        </button>

        {scanning && (
          <span data-testid="scan-progress" className="text-xs term-amber animate-pulse">
            discovering devices…
          </span>
        )}
      </div>
    </header>
  )
}
