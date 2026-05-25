import logging

from fastapi import WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token
from app.ws.manager import ws_manager

logger = logging.getLogger(__name__)


async def websocket_endpoint(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return

    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4001)
        return

    await ws_manager.connect(websocket, user_id)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg_type == "subscribe_ticket":
                ticket_id = data.get("ticket_id")
                if ticket_id:
                    ws_manager.subscribe_ticket(user_id, ticket_id)
                    logger.debug("user=%s subscribed to ticket=%s", user_id, ticket_id)
            elif msg_type == "unsubscribe_ticket":
                ticket_id = data.get("ticket_id")
                if ticket_id:
                    ws_manager.unsubscribe_ticket(user_id, ticket_id)
    except WebSocketDisconnect:
        logger.info("WS disconnected: user=%s", user_id)
    except Exception:
        logger.exception("WS error for user=%s", user_id)
    finally:
        ws_manager.disconnect(websocket, user_id)
