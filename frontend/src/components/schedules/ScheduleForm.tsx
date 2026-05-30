import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createSchedule } from '../../api/schedules'
import { fetchDevices } from '../../api/devices'
import { toast } from 'sonner'

interface Props {
  onClose: () => void
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function ScheduleForm({ onClose }: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    device_id: '' as string | number,
    action: 'block' as 'block' | 'unblock',
    start_time: '22:00',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
  })

  const { data: devicesData } = useQuery({
    queryKey: ['devices'],
    queryFn: () => fetchDevices(),
  })

  const mutation = useMutation({
    mutationFn: () => createSchedule({
      ...form,
      device_id: form.device_id ? Number(form.device_id) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success('Schedule created')
      onClose()
    },
    onError: () => toast.error('Failed to create schedule'),
  })

  const toggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter((x) => x !== d)
        : [...f.days_of_week, d].sort(),
    }))
  }

  const inputCls =
    'w-full bg-term-bg border border-term-border rounded-[7px] px-3 py-2 text-sm text-term-fg ' +
    'placeholder-term-faint transition-colors duration-150 focus:outline-none focus:border-acc-amber'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="term-panel w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="text-acc-amber">{'>'}</span>
          <h2 className="panel-title">new schedule</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-term-text-dim">Name</label>
            <input
              data-testid="schedule-name-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Bedtime"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-term-text-dim">Device</label>
            <select
              value={form.device_id}
              onChange={(e) => setForm((f) => ({ ...f, device_id: e.target.value }))}
              className={inputCls}
            >
              <option value="">All devices</option>
              {devicesData?.devices.map((d) => (
                <option key={d.id} value={d.id}>{d.display_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-term-text-dim">Action</label>
            <div className="flex gap-2">
              <button
                data-testid="schedule-action-block"
                onClick={() => setForm((f) => ({ ...f, action: 'block' }))}
                className={`flex-1 rounded-[7px] border py-2 text-sm transition-colors duration-150 ${
                  form.action === 'block'
                    ? 'border-term-danger bg-term-danger/10 text-term-danger'
                    : 'border-term-border bg-term-bg text-term-text-dim hover:border-term-border-strong'
                }`}
              >Block</button>
              <button
                onClick={() => setForm((f) => ({ ...f, action: 'unblock' }))}
                className={`flex-1 rounded-[7px] border py-2 text-sm transition-colors duration-150 ${
                  form.action === 'unblock'
                    ? 'border-term-green bg-term-green/10 text-term-green'
                    : 'border-term-border bg-term-bg text-term-text-dim hover:border-term-border-strong'
                }`}
              >Unblock</button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-term-text-dim">Time</label>
            <input
              data-testid="schedule-time-input"
              type="time"
              value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              className="bg-term-bg border border-term-border rounded-[7px] px-3 py-2 text-sm text-term-fg tabular-nums transition-colors duration-150 focus:outline-none focus:border-acc-amber"
            />
          </div>

          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-wider text-term-text-dim">Days</label>
            <div className="flex gap-1">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  onClick={() => toggleDay(i)}
                  className={`flex-1 rounded-[6px] border py-1.5 text-xs transition-colors duration-150 ${
                    form.days_of_week.includes(i)
                      ? 'border-acc-amber bg-acc-amber/10 text-acc-amber'
                      : 'border-term-border bg-term-bg text-term-faint hover:border-term-border-strong'
                  }`}
                >
                  {day.slice(0, 1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="term-btn flex-1 justify-center">
            Cancel
          </button>
          <button
            data-testid="schedule-submit"
            onClick={() => mutation.mutate()}
            disabled={!form.name || mutation.isPending}
            className="term-btn term-btn-amber flex-1 justify-center"
          >
            Create Schedule
          </button>
        </div>
      </div>
    </div>
  )
}
