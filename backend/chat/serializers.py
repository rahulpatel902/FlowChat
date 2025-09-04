from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Count
from .models import ChatRoom, ChatRoomMember, MessageMetadata
from accounts.serializers import UserListSerializer

User = get_user_model()


class ChatRoomMemberSerializer(serializers.ModelSerializer):
    user = UserListSerializer(read_only=True)
    
    class Meta:
        model = ChatRoomMember
        fields = ('user', 'role', 'joined_at', 'last_read_at')


class ChatRoomSerializer(serializers.ModelSerializer):
    # Correct reverse relation name for the through model is 'chatroommember_set'
    members = ChatRoomMemberSerializer(source='chatroommember_set', many=True, read_only=True)
    created_by = UserListSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    # Write-only management fields
    add_member_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    remove_member_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    
    class Meta:
        model = ChatRoom
        fields = (
            'id', 'name', 'room_type', 'description', 'avatar_url', 'created_by', 
            'members', 'member_count', 'last_message', 'unread_count',
            'created_at', 'updated_at', 'firebase_collection_name',
            'add_member_ids', 'remove_member_ids'
        )
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')
    
    def get_member_count(self, obj):
        return obj.members.count()
    
    def get_last_message(self, obj):
        last_message = obj.messages.first()
        if last_message:
            return MessageMetadataSerializer(last_message).data
        return None
    
    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                member = obj.chatroommember_set.get(user=request.user)
                return obj.messages.filter(created_at__gt=member.last_read_at).count()
            except ChatRoomMember.DoesNotExist:
                return 0

    def update(self, instance, validated_data):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError('Authentication required')

        # Only admins can modify group data
        try:
            membership = ChatRoomMember.objects.get(user=request.user, room=instance)
        except ChatRoomMember.DoesNotExist:
            raise serializers.ValidationError('Not a member of this room')

        if membership.role != 'admin':
            raise serializers.ValidationError('Only admins can modify this room')

        # Basic fields
        name = validated_data.get('name', None)
        description = validated_data.get('description', None)
        avatar_url = validated_data.get('avatar_url', None)
        if name is not None:
            instance.name = name
        if description is not None:
            instance.description = description
        if avatar_url is not None:
            instance.avatar_url = avatar_url

        # Member management
        add_ids = validated_data.pop('add_member_ids', [])
        remove_ids = validated_data.pop('remove_member_ids', [])

        # Add members
        for uid in add_ids:
            try:
                u = User.objects.get(id=uid)
            except User.DoesNotExist:
                continue
            ChatRoomMember.objects.get_or_create(user=u, room=instance, defaults={'role': 'member'})

        # Remove members (prevent removing self if sole admin)
        for uid in remove_ids:
            try:
                m = ChatRoomMember.objects.get(user_id=uid, room=instance)
            except ChatRoomMember.DoesNotExist:
                continue
            # Prevent removing the last admin
            if m.role == 'admin':
                admin_count = ChatRoomMember.objects.filter(room=instance, role='admin').count()
                if admin_count <= 1:
                    # skip removing last admin
                    continue
            m.delete()

        instance.save()
        return instance


class ChatRoomCreateSerializer(serializers.ModelSerializer):
    member_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = ChatRoom
        fields = ('name', 'room_type', 'description', 'member_ids')
    
    def create(self, validated_data):
        member_ids = validated_data.pop('member_ids', [])
        request = self.context['request']
        
        # Create the chat room
        chat_room = ChatRoom.objects.create(
            created_by=request.user,
            **validated_data
        )
        
        # Add creator as admin
        ChatRoomMember.objects.create(
            user=request.user,
            room=chat_room,
            role='admin'
        )
        
        # Add other members
        for user_id in member_ids:
            try:
                user = User.objects.get(id=user_id)
                ChatRoomMember.objects.create(
                    user=user,
                    room=chat_room,
                    role='member'
                )
            except User.DoesNotExist:
                continue
        
        return chat_room


class MessageMetadataSerializer(serializers.ModelSerializer):
    sender = UserListSerializer(read_only=True)
    read_by = serializers.SerializerMethodField()
    
    class Meta:
        model = MessageMetadata
        fields = (
            'id', 'firebase_message_id', 'room', 'sender', 
            'message_type', 'read_by', 'created_at'
        )
        read_only_fields = ('id', 'sender', 'created_at')
    
    def get_read_by(self, obj):
        # Read receipts now handled by Firebase
        return []


class DirectMessageCreateSerializer(serializers.Serializer):
    recipient_id = serializers.IntegerField()
    
    def validate_recipient_id(self, value):
        request = self.context['request']
        if value == request.user.id:
            raise serializers.ValidationError("Cannot create chat with yourself")
        
        try:
            User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("Recipient does not exist")
        
        return value
    
    def create(self, validated_data):
        request = self.context['request']
        recipient = User.objects.get(id=validated_data['recipient_id'])
        
        # Check if direct message room already exists
        # Ensure both the current user AND the recipient are members of the room
        existing_room = (
            ChatRoom.objects.filter(room_type='direct')
            .filter(members=request.user)
            .filter(members=recipient)
            .first()
        )
        
        if existing_room:
            return existing_room
        
        # Create new direct message room
        chat_room = ChatRoom.objects.create(
            room_type='direct',
            created_by=request.user
        )
        
        # Add both users as members
        ChatRoomMember.objects.create(user=request.user, room=chat_room, role='member')
        ChatRoomMember.objects.create(user=recipient, room=chat_room, role='member')
        
        return chat_room
