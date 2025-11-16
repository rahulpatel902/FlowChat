from django.urls import path
from .views import (
    ChatRoomListView, ChatRoomCreateView, ChatRoomDetailView,
    DirectMessageCreateView, mark_messages_read, create_message_metadata, leave_room,
    upload_chat_image, upload_chat_file, upload_profile_picture, upload_group_avatar,
)

urlpatterns = [
    path('rooms/', ChatRoomListView.as_view(), name='chat_room_list'),
    path('rooms/create/', ChatRoomCreateView.as_view(), name='chat_room_create'),
    path('rooms/<uuid:pk>/', ChatRoomDetailView.as_view(), name='chat_room_detail'),
    path('rooms/<uuid:room_id>/leave/', leave_room, name='leave_room'),
    path('direct/', DirectMessageCreateView.as_view(), name='direct_message_create'),
    path('rooms/<uuid:room_id>/read/', mark_messages_read, name='mark_messages_read'),
    path('rooms/<uuid:room_id>/messages/create/', create_message_metadata, name='create_message_metadata'),
    path('uploads/chat-image/', upload_chat_image, name='upload_chat_image'),
    path('uploads/chat-file/', upload_chat_file, name='upload_chat_file'),
    path('uploads/profile-picture/', upload_profile_picture, name='upload_profile_picture'),
    path('uploads/group-avatar/', upload_group_avatar, name='upload_group_avatar'),
]
