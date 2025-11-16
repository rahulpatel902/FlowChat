from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Q, Count
from django.shortcuts import get_object_or_404
from .models import ChatRoom, ChatRoomMember, MessageMetadata
from .serializers import (
    ChatRoomSerializer, ChatRoomCreateSerializer, MessageMetadataSerializer,
    DirectMessageCreateSerializer
)
import cloudinary.uploader


class ChatRoomListView(generics.ListAPIView):
    serializer_class = ChatRoomSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return ChatRoom.objects.filter(
            members=self.request.user
        ).prefetch_related('members', 'messages').order_by('-updated_at')


class ChatRoomCreateView(generics.CreateAPIView):
    serializer_class = ChatRoomCreateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class ChatRoomDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ChatRoomSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return ChatRoom.objects.filter(members=self.request.user)


class DirectMessageCreateView(generics.CreateAPIView):
    serializer_class = DirectMessageCreateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        chat_room = serializer.save()
        
        return Response(
            ChatRoomSerializer(chat_room, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )




@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_messages_read(request, room_id):
    try:
        room = ChatRoom.objects.get(id=room_id, members=request.user)
        member = ChatRoomMember.objects.get(user=request.user, room=room)
        
        # Update last read timestamp
        from django.utils import timezone
        member.last_read_at = timezone.now()
        member.save()
        
        return Response(
            {'message': 'Messages marked as read'},
            status=status.HTTP_200_OK
        )
    except (ChatRoom.DoesNotExist, ChatRoomMember.DoesNotExist):
        return Response(
            {'error': 'Room or membership not found'},
            status=status.HTTP_404_NOT_FOUND
        )




@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_message_metadata(request, room_id):
    try:
        room = ChatRoom.objects.get(id=room_id, members=request.user)
        
        message_metadata = MessageMetadata.objects.create(
            firebase_message_id=request.data.get('firebase_message_id'),
            room=room,
            sender=request.user,
            message_type=request.data.get('message_type', 'text')
        )
        
        return Response(
            MessageMetadataSerializer(message_metadata).data,
            status=status.HTTP_201_CREATED
        )
    except ChatRoom.DoesNotExist:
        return Response(
            {'error': 'Room not found or access denied'},
            status=status.HTTP_404_NOT_FOUND
        )


# --- Cloudinary upload endpoints ---


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def upload_chat_image(request):
    """Upload a chat image to Cloudinary and return its URL."""
    file_obj = request.FILES.get('file')
    room_id = request.data.get('room_id', 'general')
    if not file_obj:
        return Response({'detail': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = cloudinary.uploader.upload(
            file_obj,
            folder=f"chat_images/{room_id}",
            resource_type="image",
        )
        return Response(
            {
                'url': result.get('secure_url') or result.get('url'),
                'public_id': result.get('public_id'),
            },
            status=status.HTTP_201_CREATED,
        )
    except Exception as e:
        return Response({'detail': 'Upload failed', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def upload_chat_file(request):
    """Upload a generic chat file (documents, etc.) to Cloudinary and return its URL."""
    file_obj = request.FILES.get('file')
    room_id = request.data.get('room_id', 'general')
    if not file_obj:
        return Response({'detail': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = cloudinary.uploader.upload(
            file_obj,
            folder=f"chat_files/{room_id}",
            resource_type="auto",
        )
        return Response(
            {
                'url': result.get('secure_url') or result.get('url'),
                'public_id': result.get('public_id'),
            },
            status=status.HTTP_201_CREATED,
        )
    except Exception as e:
        return Response({'detail': 'Upload failed', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def upload_profile_picture(request):
    """Upload the current user's profile picture to Cloudinary and return its URL."""
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({'detail': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = cloudinary.uploader.upload(
            file_obj,
            folder=f"profile_pictures/{request.user.id}",
            resource_type="image",
        )
        return Response(
            {
                'url': result.get('secure_url') or result.get('url'),
                'public_id': result.get('public_id'),
            },
            status=status.HTTP_201_CREATED,
        )
    except Exception as e:
        return Response({'detail': 'Upload failed', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def upload_group_avatar(request):
    """Upload a group chat avatar for a room the user belongs to."""
    file_obj = request.FILES.get('file')
    room_id = request.data.get('room_id')
    if not file_obj or not room_id:
        return Response({'detail': 'file and room_id are required'}, status=status.HTTP_400_BAD_REQUEST)

    # Ensure the user is a member of the room
    try:
        room = ChatRoom.objects.get(id=room_id, members=request.user)
    except ChatRoom.DoesNotExist:
        return Response({'detail': 'Room not found or access denied'}, status=status.HTTP_404_NOT_FOUND)

    try:
        result = cloudinary.uploader.upload(
            file_obj,
            folder=f"group_avatars/{room.id}",
            resource_type="image",
        )
        return Response(
            {
                'url': result.get('secure_url') or result.get('url'),
                'public_id': result.get('public_id'),
            },
            status=status.HTTP_201_CREATED,
        )
    except Exception as e:
        return Response({'detail': 'Upload failed', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def leave_room(request, room_id):
    """
    Remove the current user from a chat room.
    For direct messages, this effectively hides the room from the user's list.
    For group chats, this removes the user from the member list.
    """
    try:
        room = ChatRoom.objects.get(id=room_id, members=request.user)
        
        # Remove the user from the room
        ChatRoomMember.objects.filter(room=room, user=request.user).delete()
        
        return Response(
            {'message': 'Successfully left the room'},
            status=status.HTTP_200_OK
        )
    except ChatRoom.DoesNotExist:
        return Response(
            {'error': 'Room not found or access denied'},
            status=status.HTTP_404_NOT_FOUND
        )
