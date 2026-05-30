import { useState } from 'react'
import { RefreshCw, Bell } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { triggerScan } from '../../api/devices'
import { toast } from 'sonner'
import { useLocation } from 'react-router-dom'

const PAGE_TITLES: Record<string, string> = {
  '/':          'Dashboard',
  '/devices':   'Devices',
  '/groups':    'Groups',
  '/schedules': 'Schedules',
  '/usage':     'Usage',
  '/top-sites': 'Top Sites',
  '/threats':   'Threats',
  '/alerts':    'Alerts',
  '/reports':   'Reports',
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
  const title = PAGE_TITLES[location.pathname] ?? 'Roost'

  const { data: countData } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: fetchAlertCount,
    refetchInterval: 30_000,
  })
  const unread = countData?.unread_count ?? 0

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
      className="fixed top-0 right-0 flex items-center justify-between px-6 z-10"
      style={{
        left: 'var(--sidebar-width)',
        height: 'var(--topbar-height)',
        background: 'rgba(13,20,36,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Page title */}
      <h2 className="text-base font-semibold text-white">{title}</h2>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Alert bell */}
        <a href="/alerts" className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </a>

        {/* Scan button */}
        <button
          data-testid="scan-button"
          onClick={() => scanMutation.mutate()}
          disabled={scanning || scanMutation.isPending}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          style={{
            background: scanning ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.9)',
            color: '#fff',
          }}
        >
          <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
          {scanning ? 'Scanning…' : 'Scan Now'}
        </button>

        {scanning && (
          <span data-testid="scan-progress" className="text-xs text-blue-400 animate-pulse">
            Discovering devices…
          </span>
        )}
      </div>
    </header>
  )
}
