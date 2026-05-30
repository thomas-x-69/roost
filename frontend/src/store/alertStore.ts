import { create } from 'zustand'

interface Alert {
  id: number
  type: string
  severity: string
  title: string
  message: string
  device_id?: number
  created_at: string
}

interface AlertStore {
  alerts: Alert[]
  unreadCount: number
  addAlert: (alert: Alert) => void
  markRead: () => void
}

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [],
  unreadCount: 0,
  addAlert: (alert) =>
    set((s) => ({
      alerts: [alert, ...s.alerts].slice(0, 50),
      unreadCount: s.unreadCount + 1,
    })),
  markRead: () => set({ unreadCount: 0 }),
}))
