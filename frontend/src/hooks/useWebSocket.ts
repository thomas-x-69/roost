import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAlertStore } from '../store/alertStore'
import { toast } from 'sonner'

// Use wss:// when the page is served over https, ws:// otherwise. Same-origin
// host so it works behind the backend's static serving and any reverse proxy.
const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`

export type WsStatus = 'connecting' | 'connected' | 'disconnected'

// Shared status — updated by the one instance running at app root
let _status: WsStatus = 'connecting'
const _listeners = new Set<(s: WsStatus) => void>()
export function getWsStatus() { return _status }
export function subscribeWsStatus(fn: (s: WsStatus) => void) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}
function setWsStatus(s: WsStatus) {
  _status = s
  _listeners.forEach((fn) => fn(s))
}

export function useWsStatus(): WsStatus {
  const [status, setStatus] = useState<WsStatus>(_status)
  useEffect(() => {
    const unsub = subscribeWsStatus(setStatus)
    return () => { unsub() }
  }, [])
  return status
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const queryClient = useQueryClient()
  const addAlert = useAlertStore((s) => s.addAlert)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setWsStatus('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setWsStatus('connected')
    }

    ws.onmessage = (evt) => {
      try {
        const { event, data } = JSON.parse(evt.data)
        handleEvent(event, data)
      } catch {}
    }

    ws.onclose = () => {
      setWsStatus('disconnected')
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }

    function handleEvent(event: string, data: any) {
      switch (event) {
        case 'device:blocked':
        case 'device:unblocked':
        case 'device:online':
        case 'device:offline':
        case 'device:new':
        case 'devices:refresh':
          queryClient.invalidateQueries({ queryKey: ['devices'] })
          break
        case 'alert:new':
          addAlert(data)
          // Refresh alert list
          queryClient.invalidateQueries({ queryKey: ['alerts'] })
          if (data.severity === 'critical') {
            toast.error(data.title, { description: data.message })
          } else if (data.severity === 'warning') {
            toast.warning(data.title, { description: data.message })
          } else {
            toast.info(data.title, { description: data.message })
          }
          break
        case 'bandwidth:tick':
          // Could update per-device bandwidth in a store here
          break
      }
    }
  }, [queryClient, addAlert])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return wsRef
}
