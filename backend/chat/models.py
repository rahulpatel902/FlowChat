from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid

User = get_user_model()


class ChatRoom(models.Model):
    ROOM_TYPES = (
        ('direct', 'Direct Message'),
        ('group', 'Group Chat'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, blank=True)
    room_type = models.CharField(max_length=10, choices=ROOM_TYPES, default='direct')
    description = models.TextField(blank=True)
    avatar_url = models.URLField(max_length=2048, blank=True)  # optional group avatar image URL (Firebase URLs can be long)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_rooms')
    members = models.ManyToManyField(User, through='ChatRoomMember', related_name='chat_rooms')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'chat_rooms'
    
    def __str__(self):
        if self.room_type == 'direct':
            members = list(self.members.all()[:2])
            if len(members) == 2:
                return f"{members[0].full_name} & {members[1].full_name}"
        return self.name or f"Room {self.id}"
    
    @property
    def firebase_collection_name(self):
        """Returns the Firebase collection name for this chat room"""
        return f"chat_rooms_{self.id}"


class ChatRoomMember(models.Model):
    ROLES = (
        ('admin', 'Admin'),
        ('member', 'Member'),
    )
    
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        db_table = 'chat_room_members'
        unique_together = ('user', 'room')
    
    def __str__(self):
        return f"{self.user.full_name} in {self.room}"


class MessageMetadata(models.Model):
    """Stores message metadata in PostgreSQL while actual messages are in Firebase"""
    MESSAGE_TYPES = (
        ('text', 'Text'),
        ('image', 'Image'),
        ('file', 'File'),
        ('system', 'System'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    firebase_message_id = models.CharField(max_length=255, unique=True)
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPES, default='text')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'message_metadata'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Message {self.firebase_message_id} in {self.room}"


