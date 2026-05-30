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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-white mb-4">New Schedule</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              data-testid="schedule-name-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Bedtime"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Device</label>
            <select
              value={form.device_id}
              onChange={(e) => setForm((f) => ({ ...f, device_id: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">All devices</option>
              {devicesData?.devices.map((d) => (
                <option key={d.id} value={d.id}>{d.display_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Action</label>
            <div className="flex gap-2">
              <button
                data-testid="schedule-action-block"
                onClick={() => setForm((f) => ({ ...f, action: 'block' }))}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  form.action === 'block'
                    ? 'bg-red-900/30 border-red-700 text-red-400'
                    : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}
              >Block</button>
              <button
                onClick={() => setForm((f) => ({ ...f, action: 'unblock' }))}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  form.action === 'unblock'
                    ? 'bg-green-900/30 border-green-700 text-green-400'
                    : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}
              >Unblock</button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Time</label>
            <input
              data-testid="schedule-time-input"
              type="time"
              value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Days</label>
            <div className="flex gap-1">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  onClick={() => toggleDay(i)}
                  className={`flex-1 py-1.5 text-xs rounded transition-colors ${
                    form.days_of_week.includes(i)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {day.slice(0, 1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            data-testid="schedule-submit"
            onClick={() => mutation.mutate()}
            disabled={!form.name || mutation.isPending}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Create Schedule
          </button>
        </div>
      </div>
    </div>
  )
}
