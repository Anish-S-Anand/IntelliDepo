"""
Intelli Platform — WebSocket Manager

Manages WebSocket connections and broadcasts real-time popup notifications.
Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 10.1
"""
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict
import logging

from app.core.notifications.incident_schemas import (
    AssignmentPopupData,
    BroadcastResult
)

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    Manages WebSocket connections and broadcasts real-time notifications.
    
    This service maintains active WebSocket connections and broadcasts
    assignment popup messages to all connected clients.
    """
    
    def __init__(self):
        """Initialize WebSocket manager with empty connections dict."""
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str) -> None:
        """
        Register a new WebSocket connection.
        
        Args:
            websocket: WebSocket connection
            client_id: Unique client identifier
        """
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"WebSocket client connected: {client_id}")
    
    async def disconnect(self, client_id: str) -> None:
        """
        Remove a WebSocket connection.
        
        Args:
            client_id: Unique client identifier
        """
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"WebSocket client disconnected: {client_id}")
    
    async def broadcast_assignment_popup(
        self,
        incident_data: AssignmentPopupData
    ) -> BroadcastResult:
        """
        Broadcast assignment popup to all connected WebSocket clients.
        
        Args:
            incident_data: Assignment information to display
            
        Returns:
            BroadcastResult with count of clients notified
        """
        message = {
            "type": "assignment_popup",
            "data": incident_data.model_dump(mode="json")
        }
        
        notified_count = 0
        disconnected_clients = []
        
        # Iterate through all active WebSocket connections
        for client_id, websocket in list(self.active_connections.items()):
            try:
                await websocket.send_json(message)
                notified_count += 1
            except WebSocketDisconnect:
                logger.warning(f"Client {client_id} disconnected during broadcast")
                disconnected_clients.append(client_id)
            except Exception as e:
                logger.warning(f"Failed to send to client {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.active_connections.pop(client_id, None)
        
        logger.info(
            f"Broadcast complete: {notified_count} clients notified, "
            f"{len(disconnected_clients)} disconnected"
        )
        
        return BroadcastResult(
            clients_notified=notified_count,
            clients_disconnected=len(disconnected_clients)
        )


# Global WebSocket manager instance
websocket_manager = WebSocketManager()
