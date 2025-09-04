from django.contrib import admin
from .models import ChatRoom, ChatRoomMember, MessageMetadata


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'room_type', 'created_by', 'member_count', 'created_at')
    list_filter = ('room_type', 'created_at')
    search_fields = ('name', 'description', 'created_by__email')
    readonly_fields = ('id', 'created_at', 'updated_at', 'firebase_collection_name')
    
    def member_count(self, obj):
        return obj.members.count()
    member_count.short_description = 'Members'


@admin.register(ChatRoomMember)
class ChatRoomMemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'room', 'role', 'joined_at', 'last_read_at')
    list_filter = ('role', 'joined_at')
    search_fields = ('user__email', 'room__name')


@admin.register(MessageMetadata)
class MessageMetadataAdmin(admin.ModelAdmin):
    list_display = ('firebase_message_id', 'room', 'sender', 'message_type', 'created_at')
    list_filter = ('message_type', 'created_at')
    search_fields = ('firebase_message_id', 'sender__email', 'room__name')
    readonly_fields = ('id', 'created_at')


