import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSchedules, deleteSchedule, toggleSchedule } from '../../api/schedules'
import { Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'
import AsciiIcon from '../ui/AsciiIcon'

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
      <div className="rounded-[10px] border border-dashed border-term-border bg-term-bg-2 px-5 py-10 text-center">
        <AsciiIcon name="schedules" className="text-2xl text-acc-amber" title="" />
        <p className="mt-2 text-sm text-term-text-dim">no schedules yet</p>
        <p className="mt-1 text-xs text-term-faint">
          create one to automatically block/unblock devices
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {schedules.map((s: any) => (
        <div
          key={s.id}
          data-testid="schedule-card"
          className={`term-panel flex items-center justify-between px-4 py-3.5 transition-colors duration-150 hover:border-term-border-strong ${
            s.is_active ? '' : 'opacity-60'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className={`dot ${s.action === 'block' ? 'dot-blocked' : 'dot-online'}`} />
            <div>
              <div className="text-sm font-medium text-term-fg">{s.name}</div>
              <div className="mt-0.5 text-xs text-term-faint">
                <span className={s.action === 'block' ? 'text-term-danger' : 'text-term-green'}>
                  {s.action}
                </span>
                {' at '}
                <span className="text-term-text-dim tabular-nums">{s.start_time}</span>
                {' · '}
                <span className="text-term-text-dim">
                  {s.days_of_week.map((d: number) => DAYS[d]).join(' ')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleMutation.mutate(s.id)}
              className="text-term-faint transition-colors hover:text-term-fg"
              title={s.is_active ? 'Disable schedule' : 'Enable schedule'}
            >
              {s.is_active ? <ToggleRight size={20} className="text-acc-amber" /> : <ToggleLeft size={20} />}
            </button>
            <button
              onClick={() => deleteMutation.mutate(s.id)}
              className="text-term-faint transition-colors hover:text-term-danger"
              title="Delete schedule"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
