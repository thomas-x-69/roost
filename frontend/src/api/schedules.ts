import client from './client'

export interface ScheduleCreate {
  name: string
  device_id?: number
  action: 'block' | 'unblock'
  days_of_week: number[]
  start_time: string
  end_time?: string
}

export const listSchedules = async () => {
  const { data } = await client.get('/schedules')
  return data
}

export const createSchedule = async (payload: ScheduleCreate) => {
  const { data } = await client.post('/schedules', payload)
  return data
}

export const deleteSchedule = async (id: number) => {
  const { data } = await client.delete(`/schedules/${id}`)
  return data
}

export const toggleSchedule = async (id: number) => {
  const { data } = await client.post(`/schedules/${id}/toggle`)
  return data
}

export const blockDevice = async (id: number) => {
  const { data } = await client.post(`/devices/${id}/block`)
  return data
}

export const unblockDevice = async (id: number) => {
  const { data } = await client.post(`/devices/${id}/unblock`)
  return data
}

export const setBandwidthLimit = async (id: number, limit_kbps: number) => {
  const { data } = await client.post(`/devices/${id}/bandwidth-limit`, { limit_kbps })
  return data
}
