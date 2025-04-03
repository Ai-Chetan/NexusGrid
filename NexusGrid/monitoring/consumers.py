import json
from channels.generic.websocket import AsyncWebsocketConsumer

#this file is for socketio
class DashboardConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.mac_address = self.scope["url_route"]["kwargs"]["mac_address"]
        self.room_group_name = f"dashboard_{self.mac_address}"

        # Add user to WebSocket group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        await self.channel_layer.group_send(
            self.room_group_name, {"type": "update_dashboard", "data": data}
        )

    async def update_dashboard(self, event):
        await self.send(text_data=json.dumps(event["data"]))
