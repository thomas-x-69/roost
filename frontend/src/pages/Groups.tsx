import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Users } from 'lucide-react'
import client from '../api/client'
import { toast } from 'sonner'

const fetchGroups = async () => {
  const { data } = await client.get('/groups')
  return data
}

export default function Groups() {
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')
  const [showForm, setShowForm] = useState(false)

  const { data } = useQuery({ queryKey: ['groups'], queryFn: fetchGroups, staleTime: 10_000 })
  const groups = data?.groups ?? []

  const createGroup = useMutation({
    mutationFn: (name: string) => client.post('/groups', { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      setNewName('')
      setShowForm(false)
      toast.success('Group created')
    },
    onError: () => toast.error('Failed to create group'),
  })

  const deleteGroup = useMutation({
    mutationFn: (id: number) => client.delete(`/groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      toast.success('Group deleted')
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Groups</h1>
          <p className="text-gray-400 text-sm mt-1">Manage device groups</p>
        </div>
        <button
          data-testid="create-group-btn"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Plus size={16} /> New Group
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <div className="text-sm font-medium text-white mb-3">New Group</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Group name"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => createGroup.mutate(newName)}
              disabled={!newName || createGroup.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm"
            >
              Create
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div data-testid="groups-list" className="space-y-3">
        {groups.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users size={32} className="mx-auto mb-3 opacity-30" />
            <p>No groups yet. Create one to manage devices together.</p>
          </div>
        ) : (
          groups.map((g: any) => (
            <div
              key={g.id}
              data-testid="group-row"
              className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: g.color + '30', border: `1px solid ${g.color}` }}>
                  <Users size={14} style={{ color: g.color }} />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{g.name}</div>
                  <div className="text-xs text-gray-500">{g.member_count} members</div>
                </div>
              </div>
              <button
                onClick={() => deleteGroup.mutate(g.id)}
                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
