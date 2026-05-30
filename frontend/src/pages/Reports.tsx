import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { FileText, Download, RefreshCw } from 'lucide-react'
import client from '../api/client'
import { toast } from 'sonner'

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-gray-400 text-sm mt-1">Generate and download PDF network reports</p>
      </div>

      {/* Generate form */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="text-sm font-medium text-white mb-4">Generate New Report</div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
          <button
            data-testid="generate-report-btn"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm"
          >
            {generate.isPending ? (
              <><RefreshCw size={14} className="animate-spin" /> Generating...</>
            ) : (
              <><FileText size={14} /> Generate PDF</>
            )}
          </button>
        </div>
      </div>

      {/* Report list */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="px-5 py-3 border-b border-gray-700 text-sm font-medium text-white">
          Generated Reports
        </div>
        {reports.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No reports yet. Generate one above.
          </div>
        ) : (
          <div>
            {reports.map((r: any) => (
              <div key={r.filename} className="flex items-center justify-between px-5 py-3 border-b border-gray-700 last:border-0 hover:bg-gray-700/50">
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-gray-500" />
                  <div>
                    <div className="text-sm text-white">{r.filename}</div>
                    <div className="text-xs text-gray-500">{formatSize(r.size)}</div>
                  </div>
                </div>
                <a
                  href={`/api/v1/reports/${r.filename}`}
                  download={r.filename}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs"
                >
                  <Download size={12} /> Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
