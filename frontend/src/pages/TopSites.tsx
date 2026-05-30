import { useQuery } from '@tanstack/react-query'
import { getTopSites } from '../api/usage'
import AsciiIcon from '../components/ui/AsciiIcon'

const ACCENT = 'var(--acc-blue)'

export default function TopSites() {
  const { data: sites = [], isLoading } = useQuery({
    queryKey: ['top-sites'],
    queryFn: getTopSites,
    refetchInterval: 60000,
  })

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AsciiIcon name="top-sites" color={ACCENT} className="text-xl" />
        <div>
          <h1 className="text-lg text-term-fg">
            <span style={{ color: ACCENT }}>top-sites</span>
            <span className="text-term-text-dim">:~$ </span>
            queries
          </h1>
          <p className="mt-0.5 text-xs text-term-text-dim">DNS queries captured from your network</p>
        </div>
      </div>

      <div className="term-panel overflow-hidden">
        <div className="panel-head">
          <span className="panel-title">resolved domains</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-term-faint">
            <span className="term-prompt">loading</span><span className="blink" />
          </div>
        ) : sites.length === 0 ? (
          <div className="p-8 text-center text-sm text-term-faint">
            <span className="term-prompt">no DNS data yet — queries appear after traffic capture starts</span>
          </div>
        ) : (
          <table data-testid="top-sites-table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-term-border text-[11px] uppercase tracking-wider text-term-faint">
                <th className="px-5 py-3 text-left font-medium">Domain</th>
                <th className="px-5 py-3 text-right font-medium">Queries</th>
                <th className="px-5 py-3 text-right font-medium">Devices</th>
                <th className="px-5 py-3 text-center font-medium">Threat</th>
              </tr>
            </thead>
            <tbody>
              {sites.map(site => (
                <tr
                  key={site.domain}
                  data-testid="domain-row"
                  className="border-b border-term-border transition-colors duration-150 last:border-0 hover:bg-term-bg-3"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {site.is_threat ? (
                        <AsciiIcon name="threats" color="var(--acc-red)" className="shrink-0" />
                      ) : (
                        <AsciiIcon name="online" color="var(--acc-blue)" className="shrink-0" />
                      )}
                      <span className={`font-mono text-xs ${site.is_threat ? 'text-acc-red' : 'text-term-text-dim'}`}>
                        {site.domain}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-term-text-dim">{site.query_count.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-term-faint">{site.device_count}</td>
                  <td className="px-5 py-3 text-center">
                    {site.is_threat ? (
                      <span className="rounded-[6px] border border-acc-red/40 bg-acc-red/10 px-2 py-0.5 text-xs text-acc-red">
                        {site.threat_type ?? 'Threat'}
                      </span>
                    ) : (
                      <span className="text-xs text-term-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
