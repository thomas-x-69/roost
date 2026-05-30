import { useEffect, useRef } from 'react'
import type { Device } from '../../types/device'

interface Props {
  devices: Device[]
  gatewayIp?: string
}

export default function NetworkMap({ devices, gatewayIp }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || devices.length === 0) return
    const container = containerRef.current
    let network: any = null

    const init = async () => {
      try {
        const { DataSet } = await import('vis-data')
        const { Network } = await import('vis-network')

        const gateway = devices.find(d => d.ip_address === gatewayIp || d.device_type === 'router')
        const routerId = gateway ? `dev-${gateway.id}` : 'gateway'

        const nodes: any[] = []
        const edges: any[] = []

        nodes.push({
          id: routerId,
          label: gateway?.display_name ?? 'Router',
          shape: 'box',
          color: { background: '#1e40af', border: '#3b82f6' },
          font: { color: '#f3f4f6', size: 12 },
          fixed: { x: true, y: true },
          x: 0, y: 0,
        })

        const deviceList = gateway ? devices.filter(d => d.id !== gateway.id) : devices
        deviceList.forEach((dev, i) => {
          const angle = (2 * Math.PI * i) / Math.max(deviceList.length, 1)
          const radius = 200
          nodes.push({
            id: `dev-${dev.id}`,
            label: dev.display_name,
            shape: 'dot',
            size: 16,
            color: dev.is_blocked
              ? { background: '#7f1d1d', border: '#ef4444' }
              : dev.is_online
              ? { background: '#14532d', border: '#22c55e' }
              : { background: '#1f2937', border: '#6b7280' },
            font: { color: '#d1d5db', size: 10 },
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
          })
          edges.push({
            from: routerId,
            to: `dev-${dev.id}`,
            color: { color: dev.is_blocked ? '#7f1d1d' : '#374151' },
            width: dev.is_online ? 2 : 1,
            dashes: !dev.is_online,
          })
        })

        network = new Network(
          container,
          { nodes: new DataSet(nodes), edges: new DataSet(edges) },
          { physics: { enabled: false }, interaction: { hover: true } },
        )
        ;(window as any).__visNetwork = network
      } catch (e) {
        // vis-network unavailable — show fallback
      }
    }

    init()
    return () => { if (network) { network.destroy(); (window as any).__visNetwork = null } }
  }, [devices, gatewayIp])

  return (
    <div
      ref={containerRef}
      data-testid="network-map"
      className="w-full h-full"
      style={{ background: '#111827', borderRadius: 8 }}
    />
  )
}
