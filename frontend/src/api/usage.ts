import client from './client'
import type { UsageSummary, DeviceUsage, UsageHistory, DnsSite } from '../types/usage'

export const getUsageSummary = async (): Promise<UsageSummary> => {
  const { data } = await client.get('/usage/summary')
  return data
}

export const getTopDevices = async (): Promise<DeviceUsage[]> => {
  const { data } = await client.get('/usage/top-devices')
  return data
}

export const getUsageHistory = async (deviceId: number, period: string): Promise<UsageHistory[]> => {
  const { data } = await client.get('/usage/history', { params: { device_id: deviceId, period } })
  return data
}

export const getTopSites = async (): Promise<DnsSite[]> => {
  const { data } = await client.get('/usage/dns/top-sites')
  return data
}

export const getDeviceDns = async (deviceId: number): Promise<DnsSite[]> => {
  const { data } = await client.get(`/usage/dns/device/${deviceId}`)
  return data
}
