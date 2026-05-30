"""
WebSocket endpoint at /ws.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.websocket.manager import manager
from backend.websocket import events

router = APIRouter()
logger = logging.getLogger("roost.ws.router")


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_id = await manager.connect(websocket)

    # Send welcome message
    await manager.send_to(client_id, events.CONNECTED, {
        "client_id": client_id,
        "server_time": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    })

    try:
        while True:
            # Wait for client messages (ping, subscribe, etc.)
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                msg = json.loads(raw)
                action = msg.get("action")

                if action == events.ACTION_PING:
                    await manager.send_to(client_id, "pong", {
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                elif action == events.ACTION_SUBSCRIBE:
                    manager.subscribe(client_id, msg.get("device_id"))
                elif action == events.ACTION_UNSUBSCRIBE:
                    manager.unsubscribe(client_id, msg.get("device_id"))

            except asyncio.TimeoutError:
                # Send keepalive ping
                try:
                    await manager.send_to(client_id, "ping", {})
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"WS error for {client_id}: {e}")
    finally:
        await manager.disconnect(client_id)
