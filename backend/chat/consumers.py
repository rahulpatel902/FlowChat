import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import ChatRoom, ChatRoomMember

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'
        self.user = self.scope['user']

        # Check if user is authenticated and is a member of the room
        if not self.user.is_authenticated:
            await self.close()
            return

        is_member = await self.check_room_membership()
        if not is_member:
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Update user online status
        await self.update_user_status(True)

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        # Update user online status
        if hasattr(self, 'user') and self.user.is_authenticated:
            await self.update_user_status(False)

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type', 'chat_message')

            if message_type == 'chat_message':
                await self.handle_chat_message(text_data_json)
            elif message_type == 'typing':
                await self.handle_typing(text_data_json)
            elif message_type == 'read_receipt':
                await self.handle_read_receipt(text_data_json)

        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'error': 'Invalid JSON'
            }))

    async def handle_chat_message(self, data):
        message = data.get('message', '')
        firebase_message_id = data.get('firebase_message_id', '')

        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message,
                'firebase_message_id': firebase_message_id,
                'sender_id': self.user.id,
                'sender_name': self.user.full_name,
                'timestamp': data.get('timestamp')
            }
        )

    async def handle_typing(self, data):
        is_typing = data.get('is_typing', False)

        # Send typing indicator to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing_indicator',
                'is_typing': is_typing,
                'user_id': self.user.id,
                'user_name': self.user.full_name
            }
        )

    async def handle_read_receipt(self, data):
        firebase_message_id = data.get('firebase_message_id', '')

        # Send read receipt to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'read_receipt',
                'firebase_message_id': firebase_message_id,
                'user_id': self.user.id,
                'user_name': self.user.full_name
            }
        )

    # Receive message from room group
    async def chat_message(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'firebase_message_id': event['firebase_message_id'],
            'sender_id': event['sender_id'],
            'sender_name': event['sender_name'],
            'timestamp': event['timestamp']
        }))

    async def typing_indicator(self, event):
        # Don't send typing indicator to the sender
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'typing_indicator',
                'is_typing': event['is_typing'],
                'user_id': event['user_id'],
                'user_name': event['user_name']
            }))

    async def read_receipt(self, event):
        # Send read receipt to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'read_receipt',
            'firebase_message_id': event['firebase_message_id'],
            'user_id': event['user_id'],
            'user_name': event['user_name']
        }))

    @database_sync_to_async
    def check_room_membership(self):
        try:
            ChatRoomMember.objects.get(
                user=self.user,
                room__id=self.room_id
            )
            return True
        except ChatRoomMember.DoesNotExist:
            return False

    @database_sync_to_async
    def update_user_status(self, is_online):
        self.user.set_online_status(is_online)
