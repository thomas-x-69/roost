import client from './client'
import type { DevicesResponse, Device } from '../types/device'

export const fetchDevices = async (params?: { online_only?: boolean; search?: string }): Promise<DevicesResponse> => {
  const { data } = await client.get('/devices', { params })
  return data
}

export const getDevice = async (id: number): Promise<{ device: Device }> => {
  const { data } = await client.get(`/devices/${id}`)
  return data
}

export const triggerScan = async (): Promise<{ status: string }> => {
  const { data } = await client.post('/devices/scan')
  return data
}

export const getScanStatus = async (): Promise<{ scanning: boolean }> => {
  const { data } = await client.get('/devices/scan/status')
  return data
}

export const updateDevice = async (id: number, updates: Partial<Pick<Device, 'custom_name' | 'icon_key' | 'notes' | 'is_protected'>>): Promise<{ device: Device }> => {
  const { data } = await client.patch(`/devices/${id}`, updates)
  return data
}
