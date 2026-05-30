import { useState } from 'react'
import { Plus } from 'lucide-react'
import ScheduleList from '../components/schedules/ScheduleList'
import ScheduleForm from '../components/schedules/ScheduleForm'

export default function Schedules() {
  const [showForm, setShowForm] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Schedules</h1>
          <p className="text-gray-400 text-sm mt-1">Automatically block/unblock devices at set times</p>
        </div>
        <button
          data-testid="create-schedule-btn"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Plus size={16} />
          New Schedule
        </button>
      </div>

      <ScheduleList />
      {showForm && <ScheduleForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
