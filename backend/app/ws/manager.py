import logging
from typing import Dict, List, Optional, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections with user-level and ticket-room tracking."""

    def __init__(self) -> None:
        self._user_connections: Dict[str, List[WebSocket]] = {}
        self._ticket_subscribers: Dict[str, Set[str]] = {}

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        self._user_connections.setdefault(user_id, []).append(websocket)
        logger.info("WS connected: user=%s total=%d", user_id, self._count())

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        conns = self._user_connections.get(user_id)
        if conns:
            self._user_connections[user_id] = [ws for ws in conns if ws is not websocket]
            if not self._user_connections[user_id]:
                del self._user_connections[user_id]
        # Clean up ticket subscriptions
        stale = [tid for tid, subs in self._ticket_subscribers.items() if user_id in subs]
        for tid in stale:
            self._ticket_subscribers[tid].discard(user_id)
            if not self._ticket_subscribers[tid]:
                del self._ticket_subscribers[tid]

    def subscribe_ticket(self, user_id: str, ticket_id: str) -> None:
        self._ticket_subscribers.setdefault(ticket_id, set()).add(user_id)

    def unsubscribe_ticket(self, user_id: str, ticket_id: str) -> None:
        subs = self._ticket_subscribers.get(ticket_id)
        if subs:
            subs.discard(user_id)
            if not subs:
                del self._ticket_subscribers[ticket_id]

    async def send_to_user(self, user_id: str, event: dict) -> None:
        if user_id not in self._user_connections:
            return
        dead: List[WebSocket] = []
        for ws in self._user_connections[user_id]:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

    async def broadcast_to_ticket(
        self, ticket_id: str, event: dict, exclude_user_id: Optional[str] = None
    ) -> None:
        subs = self._ticket_subscribers.get(ticket_id)
        if not subs:
            return
        for uid in subs:
            if uid != exclude_user_id:
                await self.send_to_user(uid, event)

    def is_connected(self, user_id: str) -> bool:
        return user_id in self._user_connections and bool(self._user_connections[user_id])

    @property
    def active_connections(self) -> int:
        return self._count()

    def _count(self) -> int:
        return sum(len(ws_list) for ws_list in self._user_connections.values())


ws_manager = ConnectionManager()
