import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pauseAll, resumeAll } from '../../api/system'
import { toast } from 'sonner'
import { useWsStatus } from '../../hooks/useWebSocket'

const navItems = [
  { to: '/',          cmd: 'dashboard', end: true },
  { to: '/devices',   cmd: 'devices' },
  { to: '/groups',    cmd: 'groups' },
  { to: '/schedules', cmd: 'schedules' },
  { to: '/usage',     cmd: 'usage' },
  { to: '/top-sites', cmd: 'top-sites' },
  { to: '/threats',   cmd: 'threats' },
  { to: '/alerts',    cmd: 'alerts' },
  { to: '/reports',   cmd: 'reports' },
]

// Small ASCII "ROOST" logo rendered in the sidebar header.
const ROOST_ASCII = String.raw`
 ___  ___  ___  ___ _____
| _ \/ _ \/ _ \/ __|_   _|
|   / (_) | (_) \__ \ | |
|_|_\\___/ \___/|___/ |_|
`.replace(/^\n/, '')

export default function Sidebar() {
  const queryClient = useQueryClient()
  const [paused, setPaused] = useState(false)
  const wsStatus = useWsStatus()

  const wsColor =
    wsStatus === 'connected'    ? 'bg-term-green' :
    wsStatus === 'connecting'   ? 'bg-term-amber' : 'bg-term-danger'
  const wsLabel =
    wsStatus === 'connected'    ? 'LINK UP' :
    wsStatus === 'connecting'   ? 'SYNCING' : 'LINK DOWN'

  const pauseMutation = useMutation({
    mutationFn: pauseAll,
    onSuccess: (data) => {
      setPaused(true)
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      toast.warning(`Paused ${data.blocked_count} device(s)`)
    },
    onError: () => toast.error('Failed to pause all'),
  })

  const resumeMutation = useMutation({
    mutationFn: resumeAll,
    onSuccess: (data) => {
      setPaused(false)
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      toast.success(`Resumed ${data.unblocked_count} device(s)`)
    },
    onError: () => toast.error('Failed to resume all'),
  })

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col z-20 bg-term-bg-2"
      style={{
        width: 'var(--sidebar-width)',
        borderRight: '1px solid var(--term-dim)',
      }}
    >
      {/* ── ASCII logo ── */}
      <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--term-dim)' }}>
        <pre className="term-green term-glow text-[7px] leading-[1.15] select-none m-0 overflow-hidden">
{ROOST_ASCII}
        </pre>
        <div className="mt-2 text-[11px] term-dim">
          <span className="term-green">root@roost</span>:~$ network-control
          <span className="blink" />
        </div>
      </div>

      {/* ── Nav (command list) ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div className="px-2 pb-2 text-[10px] uppercase tracking-widest term-dim">
          // commands
        </div>
        {navItems.map(({ to, cmd, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2 px-2 py-1.5 text-sm transition-colors duration-100 ${
                isActive
                  ? 'text-term-green term-glow bg-term-green/10'
                  : 'text-term-dim hover:text-term-fg hover:bg-term-green/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-term-green' : 'term-dim'}>
                  {isActive ? '>' : ' '}
                </span>
                <span className="lowercase">{cmd}</span>
                {isActive && <span className="ml-auto blink" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Pause / Resume All ── */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid var(--term-dim)' }}>
        {paused ? (
          <button
            data-testid="resume-all-btn"
            onClick={() => resumeMutation.mutate()}
            disabled={resumeMutation.isPending}
            className="term-btn w-full text-sm"
          >
            resume-all
          </button>
        ) : (
          <button
            data-testid="pause-all-btn"
            onClick={() => pauseMutation.mutate()}
            disabled={pauseMutation.isPending}
            className="term-btn term-btn-amber w-full text-sm"
          >
            pause-all-internet
          </button>
        )}
      </div>

      {/* ── Footer / status line ── */}
      <div className="px-4 py-3 flex items-center justify-between text-[11px]"
           style={{ borderTop: '1px solid var(--term-dim)' }}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 flex-shrink-0 ${wsColor} ${wsStatus === 'connected' ? 'pulse' : ''}`} />
          <span className="term-dim uppercase tracking-wide">{wsLabel}</span>
        </div>
        <span className="term-dim">v1.0</span>
      </div>
    </aside>
  )
}
