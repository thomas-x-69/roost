import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldOff, ShieldCheck, Lock } from 'lucide-react'
import { blockDevice, unblockDevice } from '../../api/schedules'
import { toast } from 'sonner'

interface Props {
  deviceId: number
  isBlocked: boolean
  isProtected: boolean
}

export default function BlockButton({ deviceId, isBlocked, isProtected }: Props) {
  const queryClient = useQueryClient()
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const currentBlocked = optimistic !== null ? optimistic : isBlocked

  const mutation = useMutation({
    mutationFn: (wasBlocked: boolean) => (wasBlocked ? unblockDevice(deviceId) : blockDevice(deviceId)),
    onMutate: () => setOptimistic(!currentBlocked),
    onSuccess: (data, wasBlocked) => {
      // Update the cache directly from the response — avoids a flicker when
      // onSettled resets optimistic state before the invalidation refetch lands
      if (data?.device) {
        // setQueriesData (plural) partial-matches every ['devices', ...] query —
        // the Devices page keys by ['devices', {search, onlineOnly}], so an exact
        // ['devices'] setQueryData would miss it.
        queryClient.setQueriesData({ queryKey: ['devices'] }, (old: any) => {
          if (!old?.devices) return old
          return { ...old, devices: old.devices.map((d: any) => d.id === deviceId ? data.device : d) }
        })
      }
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      toast.success(wasBlocked ? 'Device unblocked' : 'Device blocked')
    },
    onError: (err: any) => {
      setOptimistic(null)
      const msg = err?.response?.data?.detail || 'Failed to change device status'
      toast.error(msg)
    },
    onSettled: () => setOptimistic(null),
  })

  if (isProtected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
        <Lock size={11} />
        Protected
      </span>
    )
  }

  return (
    <button
      data-testid="block-button"
      onClick={() => mutation.mutate(currentBlocked)}
      disabled={mutation.isPending}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 ${
        currentBlocked
          ? 'bg-red-500/10 text-red-400 border-red-500/25 hover:bg-red-500/20'
          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
      }`}
    >
      {currentBlocked ? (
        <><ShieldOff size={12} /> Unblock</>
      ) : (
        <><ShieldCheck size={12} /> Block</>
      )}
    </button>
  )
}
