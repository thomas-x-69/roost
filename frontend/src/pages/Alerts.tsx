import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import client from '../api/client'

const fetchAlerts = async () => {
  const { data } = await client.get('/alerts?limit=100')
  return data
}

const severityColor = (s: string) => {
  if (s === 'critical') return 'text-red-400 bg-red-900/30 border-red-800'
  if (s === 'warning') return 'text-yellow-400 bg-yellow-900/30 border-yellow-800'
  return 'text-blue-400 bg-blue-900/30 border-blue-800'
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <p className="text-gray-400 text-sm mt-1">{alerts.length} total alerts</p>
        </div>
        <button
          onClick={() => readAll.mutate()}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700"
        >
          <CheckCheck size={14} /> Mark all read
        </button>
      </div>

      <div data-testid="alerts-list" className="space-y-2">
        {alerts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Bell size={32} className="mx-auto mb-3 opacity-30" />
            <p>No alerts yet</p>
          </div>
        ) : (
          alerts.map((a: any) => (
            <div
              key={a.id}
              data-testid="alert-row"
              className={`flex items-start gap-3 p-4 rounded-xl border ${severityColor(a.severity)} ${!a.is_read ? 'ring-1 ring-inset ring-current/20' : 'opacity-60'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{a.title}</div>
                <div className="text-xs mt-0.5 opacity-80">{a.message}</div>
                <div className="text-xs mt-1 opacity-50">{new Date(a.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
