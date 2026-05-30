import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSchedules, deleteSchedule, toggleSchedule } from '../../api/schedules'
import { Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function ScheduleList() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['schedules'],
    queryFn: listSchedules,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success('Schedule deleted')
    },
  })

  const toggleMutation = useMutation({
    mutationFn: toggleSchedule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules'] }),
  })

  const schedules = data?.schedules ?? []

  if (schedules.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        <div className="text-3xl mb-2">🕐</div>
        <p>No schedules yet. Create one to automatically block/unblock devices.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {schedules.map((s: any) => (
        <div
          key={s.id}
          data-testid="schedule-card"
          className={`bg-gray-900 border rounded-xl p-4 flex items-center justify-between ${
            s.is_active ? 'border-gray-700' : 'border-gray-800 opacity-60'
          }`}
        >
          <div>
            <div className="font-medium text-white text-sm">{s.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              <span className={s.action === 'block' ? 'text-red-400' : 'text-green-400'}>
                {s.action}
              </span>
              {' at '}
              <span className="text-gray-300">{s.start_time}</span>
              {' · '}
              <span>
                {s.days_of_week.map((d: number) => DAYS[d]).join(' ')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleMutation.mutate(s.id)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {s.is_active ? <ToggleRight size={20} className="text-blue-400" /> : <ToggleLeft size={20} />}
            </button>
            <button
              onClick={() => deleteMutation.mutate(s.id)}
              className="text-gray-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
