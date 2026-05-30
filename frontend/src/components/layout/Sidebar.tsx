import { NavLink } from 'react-router-dom'
import {
  Monitor, LayoutDashboard, Clock, PauseCircle, PlayCircle,
  Activity, Globe, Bell, ShieldAlert, Users, FileText, Lock, Unlock,
} from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pauseAll, resumeAll } from '../../api/system'
import { toast } from 'sonner'
import { useWsStatus } from '../../hooks/useWebSocket'

const navItems = [
  { to: '/',          label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/devices',   label: 'Devices',   icon: Monitor },
  { to: '/groups',    label: 'Groups',    icon: Users },
  { to: '/schedules', label: 'Schedules', icon: Clock },
  { to: '/usage',     label: 'Usage',     icon: Activity },
  { to: '/top-sites', label: 'Top Sites', icon: Globe },
  { to: '/threats',   label: 'Threats',   icon: ShieldAlert },
  { to: '/alerts',    label: 'Alerts',    icon: Bell },
  { to: '/reports',   label: 'Reports',   icon: FileText },
]

export default function Sidebar() {
  const queryClient = useQueryClient()
  const [paused, setPaused] = useState(false)
  const wsStatus = useWsStatus()

  const wsColor =
    wsStatus === 'connected'    ? 'bg-emerald-400' :
    wsStatus === 'connecting'   ? 'bg-amber-400'   : 'bg-red-400'
  const wsLabel =
    wsStatus === 'connected'    ? 'Live' :
    wsStatus === 'connecting'   ? 'Connecting…' : 'Offline'

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
      className="fixed left-0 top-0 h-screen flex flex-col z-20"
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 py-5"
           style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm select-none flex-shrink-0"
             style={{ background: 'linear-gradient(135deg,#3b82f6 0%,#6366f1 100%)' }}>
          NG
        </div>
        <div>
          <div className="font-bold text-white text-base leading-none">Roost</div>
          <div className="text-xs text-slate-500 mt-0.5">Network Control</div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                  <Icon size={17} />
                </span>
                <span>{label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Pause / Resume All ── */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        {paused ? (
          <button
            data-testid="resume-all-btn"
            onClick={() => resumeMutation.mutate()}
            disabled={resumeMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all disabled:opacity-50"
          >
            <Unlock size={15} />
            Resume All
          </button>
        ) : (
          <button
            data-testid="pause-all-btn"
            onClick={() => pauseMutation.mutate()}
            disabled={pauseMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/30 transition-all disabled:opacity-50"
          >
            <Lock size={15} />
            Pause All Internet
          </button>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-5 py-3 flex items-center justify-between"
           style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${wsColor} ${wsStatus === 'connected' ? 'pulse' : ''}`} />
          <span className="text-xs text-slate-500">{wsLabel}</span>
        </div>
        <span className="text-xs text-slate-600">v1.0</span>
      </div>
    </aside>
  )
}
