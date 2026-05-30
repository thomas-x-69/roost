"""
WebSocket connection manager.
Handles multiple clients, broadcasting, and per-device subscriptions.
"""
import asyncio
import json
import logging
import uuid
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger("roost.ws")


class ConnectionManager:
    def __init__(self):
        # All connected clients: client_id -> WebSocket
        self._clients: Dict[str, WebSocket] = {}
        # Per-device subscriptions: device_id -> set of client_ids
        self._subscriptions: Dict[int, Set[str]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> str:
        await websocket.accept()
        client_id = str(uuid.uuid4())[:8]
        async with self._lock:
            self._clients[client_id] = websocket
        logger.debug(f"WS client connected: {client_id}")
        return client_id

    async def disconnect(self, client_id: str):
        async with self._lock:
            self._clients.pop(client_id, None)
            # Remove from all subscriptions
            for subs in self._subscriptions.values():
                subs.discard(client_id)
        logger.debug(f"WS client disconnected: {client_id}")

    async def broadcast(self, event: str, data: dict):
        """Send an event to all connected clients."""
        message = json.dumps({"event": event, "data": data})
        dead = []
        async with self._lock:
            clients = dict(self._clients)
        for client_id, ws in clients.items():
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(client_id)
        for cid in dead:
            await self.disconnect(cid)

    async def send_to(self, client_id: str, event: str, data: dict):
        """Send an event to a specific client."""
        ws = self._clients.get(client_id)
        if ws:
            try:
                await ws.send_text(json.dumps({"event": event, "data": data}))
            except Exception:
                await self.disconnect(client_id)

    def subscribe(self, client_id: str, device_id: int):
        if device_id not in self._subscriptions:
            self._subscriptions[device_id] = set()
        self._subscriptions[device_id].add(client_id)

    def unsubscribe(self, client_id: str, device_id: int):
        if device_id in self._subscriptions:
            self._subscriptions[device_id].discard(client_id)

    @property
    def connection_count(self) -> int:
        return len(self._clients)


# Global singleton
manager = ConnectionManager()
