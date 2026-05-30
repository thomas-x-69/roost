export const DEVICE_ICONS: Record<string, string> = {
  smartphone: '📱',
  laptop: '💻',
  monitor: '🖥️',
  tablet: '📱',
  tv: '📺',
  gamepad: '🎮',
  router: '🌐',
  cpu: '🔌',
  device: '📡',
}

export function getDeviceEmoji(iconKey: string): string {
  return DEVICE_ICONS[iconKey] || DEVICE_ICONS.device
}
