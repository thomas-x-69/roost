"""WebSocket event type constants."""

# Server → Client events
CONNECTED = "connected"
DEVICE_NEW = "device:new"
DEVICE_ONLINE = "device:online"
DEVICE_OFFLINE = "device:offline"
DEVICE_BLOCKED = "device:blocked"
DEVICE_UNBLOCKED = "device:unblocked"
DEVICES_REFRESH = "devices:refresh"
BANDWIDTH_TICK = "bandwidth:tick"
THREAT_DETECTED = "threat:detected"
ALERT_NEW = "alert:new"

# Client → Server actions
ACTION_SUBSCRIBE = "subscribe:device"
ACTION_UNSUBSCRIBE = "unsubscribe:device"
ACTION_PING = "ping"
