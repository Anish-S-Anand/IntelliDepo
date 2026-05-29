"""
Intelli Platform — WebSocket Notification Endpoint

WebSocket endpoint for real-time incident notifications.
Requirements: 7.1, 7.2, 7.3, 7.4, 10.1
"""
import uuid
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional

from app.core.notifications.websocket_manager import websocket_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["WebSocket Notifications"])


@router.websocket("/notifications")
async def websocket_notifications_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for real-time incident notifications.
    
    Clients connect to this endpoint to receive real-time popup notifications
    when incidents are acknowledged.
    
    Query Parameters:
        token: Optional authentication token (for future auth implementation)
    """
    # Generate unique client ID
    client_id = str(uuid.uuid4())
    
    try:
        # Accept connection and register client
        await websocket_manager.connect(websocket, client_id)
        logger.info(f"WebSocket client {client_id} connected")
        
        # Send welcome message
        await websocket.send_json({
            "type": "connection_established",
            "client_id": client_id,
            "message": "Connected to incident notifications"
        })
        
        # Keep connection alive and listen for messages
        while True:
            # Receive messages from client (for heartbeat, etc.)
            data = await websocket.receive_text()
            
            # Handle heartbeat/ping messages
            if data == "ping":
                await websocket.send_json({"type": "pong"})
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket client {client_id} disconnected")
        await websocket_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        await websocket_manager.disconnect(client_id)
