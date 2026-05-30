import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../api/client'
import AsciiIcon from '../components/ui/AsciiIcon'

const fetchAlerts = async () => {
  const { data } = await client.get('/alerts?limit=100')
  return data
}

const severityStyle = (s: string) => {
  if (s === 'critical') return 'border-term-danger/40 text-term-danger'
  if (s === 'warning') return 'border-acc-orange/40 text-acc-orange'
  return 'border-term-border text-term-text-dim'
}

const severityDot = (s: string) => {
  if (s === 'critical') return 'dot-blocked'
  if (s === 'warning') return ''
  return 'dot-offline'
}

export default function Alerts() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['alerts'], queryFn: fetchAlerts, staleTime: 10_000 })
  const alerts = data?.alerts ?? []

  const readAll = useMutation({
    mutationFn: () => client.post('/alerts/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg text-term-fg">
            <span className="text-acc-orange">root@roost</span>
            <span className="text-term-text-dim">:~$ </span>
            alerts
          </h1>
          <p className="mt-0.5 text-xs text-term-text-dim tabular-nums">{alerts.length} total alerts</p>
        </div>
        <button onClick={() => readAll.mutate()} className="term-btn">
          <AsciiIcon name="unblock" title="" /> mark all read
        </button>
      </div>

      <div data-testid="alerts-list" className="space-y-2">
        {alerts.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-term-border bg-term-bg-2 px-5 py-12 text-center">
            <AsciiIcon name="alerts" className="text-2xl text-acc-orange" title="" />
            <p className="mt-2 text-sm text-term-text-dim">no alerts yet</p>
          </div>
        ) : (
          alerts.map((a: any) => (
            <div
              key={a.id}
              data-testid="alert-row"
              className={`flex items-start gap-3 rounded-[10px] border bg-term-bg-2 p-4 transition-colors duration-150 ${severityStyle(a.severity)} ${!a.is_read ? '' : 'opacity-60'}`}
            >
              <span
                className={`dot mt-1.5 ${severityDot(a.severity)}`}
                style={a.severity === 'warning' ? { background: 'var(--acc-orange)' } : undefined}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-term-fg">{a.title}</div>
                <div className="mt-0.5 text-xs text-term-text-dim">{a.message}</div>
                <div className="mt-1 text-xs text-term-faint tabular-nums">{new Date(a.created_at).toLocaleString()}</div>
              </div>
              {!a.is_read && (
                <span className="text-[10px] uppercase tracking-wider text-current">new</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
