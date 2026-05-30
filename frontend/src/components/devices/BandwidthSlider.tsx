import { useState, useCallback, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { setBandwidthLimit } from '../../api/schedules'

interface Props {
  deviceId: number
  currentLimit: number
}

export default function BandwidthSlider({ deviceId, currentLimit }: Props) {
  const [value, setValue] = useState(currentLimit)
  const editing = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const mutation = useMutation({
    mutationFn: (limit: number) => setBandwidthLimit(deviceId, limit),
    onSettled: () => { editing.current = false },
  })

  // Resync to server state when the prop changes — but never clobber the
  // value while the user is dragging or a save is in flight.
  useEffect(() => {
    if (!editing.current && !mutation.isPending) setValue(currentLimit)
  }, [currentLimit, mutation.isPending])

  // Stable debounced save that always calls the latest mutation.
  const mutate = mutation.mutate
  const debouncedSave = useCallback((v: number) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => mutate(v), 600)
  }, [mutate])

  useEffect(() => () => clearTimeout(timer.current), [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value)
    editing.current = true
    setValue(v)
    debouncedSave(v)
  }

  const label = value === 0 ? 'Unlimited' : `${value >= 1000 ? (value / 1000).toFixed(0) + ' Mbps' : value + ' Kbps'}`

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <input
        data-testid="bandwidth-slider"
        type="range"
        min={0}
        max={100000}
        step={1000}
        value={value}
        onChange={handleChange}
        className="w-20 accent-blue-500"
        title={label}
      />
      <span className="text-xs text-gray-400 w-16 text-right">{label}</span>
    </div>
  )
}
