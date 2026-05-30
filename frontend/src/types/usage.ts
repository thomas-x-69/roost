export interface UsageSummary {
  total_bytes_today: number
  total_bytes_week: number
  total_bytes_month: number
  top_device_id: number | null
}

export interface DeviceUsage {
  device_id: number
  display_name: string
  bytes_today: number
  bytes_week: number
}

export interface UsageHistory {
  time: string
  bytes_sent: number
  bytes_recv: number
}

export interface DnsSite {
  domain: string
  query_count: number
  device_count: number
  is_threat: boolean
  threat_type: string | null
}
