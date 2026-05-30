import { getDeviceEmoji } from '../../utils/deviceIcons'

interface Props {
  iconKey: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'text-base',
  md: 'text-2xl',
  lg: 'text-4xl',
}

export default function DeviceIcon({ iconKey, size = 'md' }: Props) {
  return (
    <span className={sizeClasses[size]} title={iconKey}>
      {getDeviceEmoji(iconKey)}
    </span>
  )
}
