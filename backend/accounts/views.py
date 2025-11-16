from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db.models import Q
from django.conf import settings
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from .models import User
from .serializers import (
    UserRegistrationSerializer, UserLoginSerializer, 
    UserProfileSerializer, UserUpdateSerializer, UserListSerializer
)

import logging
import firebase_admin
from firebase_admin import credentials, auth as fb_auth

logger = logging.getLogger(__name__)

if not firebase_admin._apps:
    try:
        if getattr(settings, 'FIREBASE_CREDENTIALS_FILE', ''):
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_FILE)
        else:
            cred = credentials.Certificate(settings.FIREBASE_CONFIG)
        firebase_admin.initialize_app(cred)
    except Exception:
        pass


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        frontend_base = getattr(settings, 'FRONTEND_URL', '').rstrip('/') or 'http://localhost:3000'
        verify_url = f"{frontend_base}/verify-email?uid={uid}&token={token}"

        subject = "Verify your email for FlowChat"
        message = (
            "Hello,\n\n"
            "Thank you for registering for FlowChat.\n"
            f"Please verify your email address by clicking the link below:\n{verify_url}\n\n"
            "If you did not sign up, you can ignore this email."
        )
        try:
            send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
        except Exception as e:
            logger.error("Failed to send verification email to %s: %s", user.email, e, exc_info=True)
            pass

        return Response(
            {
                'detail': 'Registration successful. Please check your email to verify your account.',
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(generics.GenericAPIView):
    serializer_class = UserLoginSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        
        # Update online status
        user.set_online_status(True)
        
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserProfileSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def firebase_custom_token(request):
    """
    Returns a Firebase custom auth token tied to the current Django user.
    The frontend should use this token with signInWithCustomToken to authenticate
    to Firebase so Firestore rules can rely on request.auth.
    """
    try:
        # Ensure app is initialized (in case settings changed at runtime)
        if not firebase_admin._apps:
            if getattr(settings, 'FIREBASE_CREDENTIALS_FILE', ''):
                cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_FILE)
            else:
                cred = credentials.Certificate(settings.FIREBASE_CONFIG)
            firebase_admin.initialize_app(cred)

        uid = str(request.user.id)

        # Ensure Firebase Auth user exists and is populated with email/display name
        display_name = (request.user.first_name + ' ' + request.user.last_name).strip() or request.user.username
        try:
            fb_user = fb_auth.get_user(uid)
            # Update email/display name if missing or changed
            needs_update = False
            update_args = {}
            if request.user.email and fb_user.email != request.user.email:
                update_args['email'] = request.user.email
            if display_name and fb_user.display_name != display_name:
                update_args['display_name'] = display_name
            if update_args:
                fb_auth.update_user(uid, **update_args)
        except fb_auth.UserNotFoundError:
            fb_auth.create_user(uid=uid, email=request.user.email or None, display_name=display_name or None)

        additional_claims = {
            'email': request.user.email,
            'username': request.user.username,
            'provider': 'django',
        }
        token_bytes = fb_auth.create_custom_token(uid, additional_claims)
        token = token_bytes.decode('utf-8') if isinstance(token_bytes, (bytes, bytearray)) else token_bytes
        return Response({'custom_token': token}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'detail': 'Failed to create Firebase custom token', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def verify_email(request):
    uid = request.data.get('uid')
    token = request.data.get('token')
    if not uid or not token:
        return Response({'detail': 'Missing uid or token'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        uid_int = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=uid_int)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response({'detail': 'Invalid verification link'}, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
        return Response({'detail': 'Invalid or expired verification token'}, status=status.HTTP_400_BAD_REQUEST)

    if not user.is_active:
        user.is_active = True
        user.save(update_fields=['is_active'])

    return Response({'detail': 'Email verified successfully. You can now log in.'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    try:
        refresh_token = request.data["refresh"]
        token = RefreshToken(refresh_token)
        token.blacklist()
        
        # Update online status
        request.user.set_online_status(False)
        
        return Response({"message": "Successfully logged out"}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method == 'PUT' or self.request.method == 'PATCH':
            return UserUpdateSerializer
        return UserProfileSerializer




@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_lookup(request):
    """
    Return a single user by exact match of username, email, or user_id.
    - username: case-insensitive exact match; leading '@' allowed and stripped
    - email: case-insensitive exact match
    - user_id: exact match by user ID
    Excludes the requesting user.
    """
    username = request.query_params.get('username')
    email = request.query_params.get('email')
    user_id = request.query_params.get('user_id')

    if not username and not email and not user_id:
        return Response({'detail': 'Provide either username, email, or user_id'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        if user_id:
            user = User.objects.exclude(id=request.user.id).get(id=user_id)
        elif username:
            uname = username.lstrip('@')
            user = User.objects.exclude(id=request.user.id).get(username__iexact=uname)
        else:
            user = User.objects.exclude(id=request.user.id).get(email__iexact=email)
    except User.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    data = UserListSerializer(user).data
    # Ensure email present (UserListSerializer includes it)
    return Response(data, status=status.HTTP_200_OK)
