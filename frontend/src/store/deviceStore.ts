import { create } from 'zustand'

interface DeviceStore {
  blockedIds: Set<number>
  setBlocked: (id: number, blocked: boolean) => void
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  blockedIds: new Set(),
  setBlocked: (id, blocked) =>
    set((s) => {
      const next = new Set(s.blockedIds)
      blocked ? next.add(id) : next.delete(id)
      return { blockedIds: next }
    }),
}))
