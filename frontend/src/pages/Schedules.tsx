import { useState } from 'react'
import AsciiIcon from '../components/ui/AsciiIcon'
import ScheduleList from '../components/schedules/ScheduleList'
import ScheduleForm from '../components/schedules/ScheduleForm'

export default function Schedules() {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg text-term-fg">
            <span className="text-acc-amber">root@roost</span>
            <span className="text-term-text-dim">:~$ </span>
            schedules
          </h1>
          <p className="mt-0.5 text-xs text-term-text-dim">
            automatically block/unblock devices at set times
          </p>
        </div>
        <button
          data-testid="create-schedule-btn"
          onClick={() => setShowForm(true)}
          className="term-btn term-btn-amber"
        >
          <AsciiIcon name="schedules" title="" />
          new schedule
        </button>
      </div>

      <ScheduleList />
      {showForm && <ScheduleForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
