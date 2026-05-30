import type { Device } from '../../types/device'
import DeviceRow from './DeviceRow'

interface Props {
  devices: Device[]
  loading?: boolean
}

const HEADERS = ['DEVICE', 'IP / MAC', 'STATUS', 'LAST SEEN', 'CONTROL', 'BANDWIDTH LIMIT']

export default function DeviceTable({ devices, loading }: Props) {
  if (loading) {
    return (
      <div className="term-panel crt scanlines flicker flex flex-col items-center justify-center py-24 gap-3">
        <span className="term-corners" />
        <p className="term-green term-glow text-sm term-prompt">
          scanning network<span className="blink-text">_</span>
        </p>
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div className="term-panel crt flex flex-col items-center justify-center py-24 gap-3">
        <span className="term-corners" />
        <pre className="term-dim text-xs leading-tight" aria-hidden="true">{`  .------.
  | ~no~ |
  | dev  |
  '------'`}</pre>
        <p className="term-dim text-sm term-prompt">
          no devices found — run <span className="term-amber">SCAN NOW</span> to discover devices
        </p>
      </div>
    )
  }

  return (
    <div className="term-panel crt scanlines relative overflow-x-auto">
      <span className="term-corners" />
      <span className="scan-beam" />
      <table data-testid="device-table" className="w-full text-left relative z-10">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--term-dim)' }}>
            {HEADERS.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-[11px] font-semibold term-green term-glow uppercase tracking-widest whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <DeviceRow key={device.mac_address} device={device} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
