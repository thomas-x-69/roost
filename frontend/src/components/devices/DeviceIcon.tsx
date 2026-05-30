import AsciiDevice from './AsciiDevice'

/**
 * DeviceIcon — thin adapter that renders the animated ASCII-art glyph
 * (AsciiDevice) for a device. It maps the legacy `iconKey` to a canonical
 * device type and forwards online / blocked state so the art animates
 * correctly. Props are kept backwards-compatible: callers that only pass
 * `iconKey` still get a (static-offline-looking) glyph.
 */

interface Props {
  iconKey: string
  /** Canonical device_type, preferred over iconKey when available. */
  deviceType?: string
  isOnline?: boolean
  isBlocked?: boolean
  size?: 'sm' | 'md' | 'lg'
}

// Legacy icon_key -> AsciiDevice type.
const ICON_KEY_TO_TYPE: Record<string, string> = {
  smartphone: 'phone',
  laptop: 'laptop',
  monitor: 'desktop',
  tablet: 'tablet',
  tv: 'tv',
  gamepad: 'console',
  router: 'router',
  cpu: 'iot',
  device: 'unknown',
}

export default function DeviceIcon({
  iconKey,
  deviceType,
  isOnline = false,
  isBlocked = false,
  size = 'md',
}: Props) {
  const type = deviceType || ICON_KEY_TO_TYPE[iconKey] || 'unknown'
  return (
    <AsciiDevice
      deviceType={type}
      isOnline={isOnline}
      isBlocked={isBlocked}
      size={size}
    />
  )
}
