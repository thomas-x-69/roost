import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import AsciiIcon from '../components/ui/AsciiIcon'
import client from '../api/client'
import { toast } from 'sonner'

const ACCENT = 'var(--acc-sand)'

const fetchReports = async () => {
  const { data } = await client.get('/reports')
  return data
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function Reports() {
  const [period, setPeriod] = useState('today')
  const { data, refetch } = useQuery({ queryKey: ['reports'], queryFn: fetchReports })
  const reports = data?.reports ?? []

  const generate = useMutation({
    mutationFn: () => client.post('/reports/generate', { period }),
    onSuccess: () => {
      refetch()
      toast.success('Report generated!')
    },
    onError: () => toast.error('Failed to generate report'),
  })

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AsciiIcon name="reports" color={ACCENT} className="text-xl" />
        <div>
          <h1 className="text-lg text-term-fg">
            <span style={{ color: ACCENT }}>reports</span>
            <span className="text-term-text-dim">:~$ </span>
            export
          </h1>
          <p className="mt-0.5 text-xs text-term-text-dim">Generate and download PDF network reports</p>
        </div>
      </div>

      {/* Generate form */}
      <div className="term-panel overflow-hidden">
        <div className="panel-head">
          <span className="panel-title">generate new report</span>
        </div>
        <div className="flex items-center gap-3 p-5">
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="rounded-[7px] border border-term-border-strong bg-term-bg-3 px-3 py-2 text-sm text-term-fg
                       transition-colors duration-150 focus:outline-none"
            style={{ outline: 'none' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#c9a26b')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--term-border-strong)')}
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
          <button
            data-testid="generate-report-btn"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="term-btn"
            style={{ color: ACCENT, borderColor: 'rgba(201,162,107,.4)', background: 'rgba(201,162,107,.12)' }}
          >
            {generate.isPending ? (
              <><AsciiIcon name="refresh" className="animate-spin" /> Generating...</>
            ) : (
              <><AsciiIcon name="reports" /> Generate PDF</>
            )}
          </button>
        </div>
      </div>

      {/* Report list */}
      <div className="term-panel overflow-hidden">
        <div className="panel-head">
          <span className="panel-title">generated reports</span>
        </div>
        {reports.length === 0 ? (
          <div className="p-8 text-center text-sm text-term-faint">
            <span className="term-prompt">no reports yet — generate one above</span>
          </div>
        ) : (
          <div>
            {reports.map((r: any) => (
              <div
                key={r.filename}
                className="flex items-center justify-between border-b border-term-border px-5 py-3
                           transition-colors duration-150 last:border-0 hover:bg-term-bg-3"
              >
                <div className="flex items-center gap-3">
                  <AsciiIcon name="reports" color={ACCENT} />
                  <div>
                    <div className="text-sm text-term-fg">{r.filename}</div>
                    <div className="text-xs text-term-faint">{formatSize(r.size)}</div>
                  </div>
                </div>
                <a
                  href={`/api/v1/reports/${r.filename}`}
                  download={r.filename}
                  className="term-btn"
                >
                  <AsciiIcon name="download" /> Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
