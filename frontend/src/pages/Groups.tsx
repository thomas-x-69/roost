import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import client from '../api/client'
import { toast } from 'sonner'
import AsciiIcon from '../components/ui/AsciiIcon'

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
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg text-term-fg">
            <span className="text-acc-violet">root@roost</span>
            <span className="text-term-text-dim">:~$ </span>
            groups
          </h1>
          <p className="mt-0.5 text-xs text-term-text-dim">manage device groups</p>
        </div>
        <button
          data-testid="create-group-btn"
          onClick={() => setShowForm(true)}
          className="term-btn"
          style={{ color: 'var(--acc-violet)', borderColor: 'rgba(169,139,219,.4)' }}
        >
          <AsciiIcon name="groups" title="" /> new group
        </button>
      </div>

      {showForm && (
        <div className="term-panel p-5">
          <div className="mb-3 flex items-center gap-2">
            <span style={{ color: 'var(--acc-violet)' }}>{'>'}</span>
            <span className="panel-title">new group</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Group name"
              className="flex-1 rounded-[7px] border border-term-border bg-term-bg px-3 py-2 text-sm text-term-fg placeholder-term-faint transition-colors duration-150 focus:outline-none focus:border-acc-violet"
            />
            <button
              onClick={() => createGroup.mutate(newName)}
              disabled={!newName || createGroup.isPending}
              className="term-btn"
              style={{ color: 'var(--acc-violet)', borderColor: 'rgba(169,139,219,.4)' }}
            >
              Create
            </button>
            <button onClick={() => setShowForm(false)} className="term-btn">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div data-testid="groups-list" className="space-y-2">
        {groups.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-term-border bg-term-bg-2 px-5 py-12 text-center">
            <AsciiIcon name="groups" className="text-2xl text-acc-violet" title="" />
            <p className="mt-2 text-sm text-term-text-dim">no groups yet</p>
            <p className="mt-1 text-xs text-term-faint">create one to manage devices together</p>
          </div>
        ) : (
          groups.map((g: any) => (
            <div
              key={g.id}
              data-testid="group-row"
              className="term-panel flex items-center justify-between px-4 py-3.5 transition-colors duration-150 hover:border-term-border-strong"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-[7px] text-sm"
                  style={{ backgroundColor: g.color + '20', border: `1px solid ${g.color}`, color: g.color }}
                >
                  <AsciiIcon name="groups" title="" />
                </span>
                <div>
                  <div className="text-sm font-medium text-term-fg">{g.name}</div>
                  <div className="text-xs text-term-faint tabular-nums">{g.member_count} members</div>
                </div>
              </div>
              <button
                onClick={() => deleteGroup.mutate(g.id)}
                className="rounded-[7px] p-2 text-term-faint transition-colors duration-150 hover:bg-term-danger/10 hover:text-term-danger"
                title="Delete group"
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
