export interface Device {
  id: number
  mac_address: string
  ip_address: string | null
  hostname: string | null
  vendor: string | null
  device_type: string
  display_name: string
  custom_name: string | null
  icon_key: string
  notes: string | null
  is_online: boolean
  is_blocked: boolean
  is_protected: boolean
  bandwidth_limit_kbps: number
  first_seen: string | null
  last_seen: string | null
}

export interface DevicesResponse {
  devices: Device[]
  total: number
}
