import { useState, useCallback, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Gauge } from 'lucide-react'
import { setBandwidthLimit } from '../../api/schedules'

interface Props {
  deviceId: number
  /** Current effective limit in kbps. 0 == unlimited. */
  currentLimit: number
}

// Quick presets in kbps. 0 == unlimited / off. People typically cap at the
// low end (256k/512k/1M) so most presets live there, with a few coarse high
// values for the rare "slow this device down a lot but not fully" case.
const PRESETS: { label: string; kbps: number }[] = [
  { label: 'Off', kbps: 0 },
  { label: '256K', kbps: 256 },
  { label: '512K', kbps: 512 },
  { label: '1M', kbps: 1_000 },
  { label: '5M', kbps: 5_000 },
  { label: '10M', kbps: 10_000 },
  { label: '25M', kbps: 25_000 },
  { label: '50M', kbps: 50_000 },
  { label: '100M', kbps: 100_000 },
]

const MAX_KBPS = 10_000_000 // matches backend BandwidthLimitBody le=10_000_000

/** Human-readable label for a kbps value. */
function formatLimit(kbps: number): string {
  if (kbps <= 0) return 'Unlimited'
  if (kbps >= 1_000) {
    const mbps = kbps / 1_000
    // Avoid trailing ".0" for whole numbers.
    return `${Number.isInteger(mbps) ? mbps : mbps.toFixed(2).replace(/\.?0+$/, '')} Mbps`
  }
  return `${kbps} Kbps`
}

export default function BandwidthSlider({ deviceId, currentLimit }: Props) {
  const [value, setValue] = useState(currentLimit)
  // The numeric input is edited in Mbps for ergonomics; keep its raw text so a
  // partially-typed value (e.g. "1.") isn't fought by reformatting.
  const [mbpsText, setMbpsText] = useState(() =>
    currentLimit > 0 ? String(currentLimit / 1_000) : ''
  )
  const editing = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const mutation = useMutation({
    mutationFn: (limit: number) => setBandwidthLimit(deviceId, limit),
    onSettled: () => { editing.current = false },
  })

  // Resync to server state when the prop changes — but never clobber the value
  // while the user is editing or a save is in flight.
  useEffect(() => {
    if (!editing.current && !mutation.isPending) {
      setValue(currentLimit)
      setMbpsText(currentLimit > 0 ? String(currentLimit / 1_000) : '')
    }
  }, [currentLimit, mutation.isPending])

  // Stable debounced save that always calls the latest mutation.
  const mutate = mutation.mutate
  const debouncedSave = useCallback((v: number) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => mutate(v), 600)
  }, [mutate])

  useEffect(() => () => clearTimeout(timer.current), [])

  const commit = useCallback((kbps: number) => {
    const clamped = Math.max(0, Math.min(MAX_KBPS, Math.round(kbps)))
    editing.current = true
    setValue(clamped)
    debouncedSave(clamped)
  }, [debouncedSave])

  const applyPreset = (kbps: number) => {
    commit(kbps)
    setMbpsText(kbps > 0 ? String(kbps / 1_000) : '')
  }

  const handleMbpsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value
    setMbpsText(text)
    if (text.trim() === '') {
      commit(0) // empty == unlimited
      return
    }
    const mbps = parseFloat(text)
    if (!Number.isNaN(mbps) && mbps >= 0) {
      commit(mbps * 1_000)
    }
  }

  return (
    <div
      data-testid="bandwidth-slider"
      className="flex flex-col gap-1.5 min-w-[200px] font-mono"
    >
      {/* Current effective limit */}
      <div className="flex items-center gap-1.5 text-xs">
        <Gauge size={12} className={value > 0 ? 'text-amber-400' : 'text-slate-500'} />
        <span className="text-slate-400">limit:</span>
        <span className={value > 0 ? 'text-amber-300' : 'text-slate-500'}>
          {formatLimit(value)}
        </span>
        {mutation.isPending && <span className="text-slate-600">saving…</span>}
      </div>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => {
          const active = value === p.kbps
          return (
            <button
              key={p.kbps}
              type="button"
              data-testid={`bw-preset-${p.kbps}`}
              onClick={() => applyPreset(p.kbps)}
              className={`px-1.5 py-0.5 rounded text-[10px] leading-none border transition-colors ${
                active
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Exact numeric entry (in Mbps) */}
      <div className="flex items-center gap-1 text-xs">
        <input
          type="number"
          min={0}
          step={0.1}
          inputMode="decimal"
          data-testid="bw-exact-input"
          value={mbpsText}
          onChange={handleMbpsChange}
          placeholder="∞"
          className="w-20 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 focus:border-amber-500/50 focus:outline-none"
          title="Exact limit in Mbps (blank = unlimited)"
        />
        <span className="text-slate-500">Mbps</span>
      </div>
    </div>
  )
}
