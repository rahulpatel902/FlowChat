import urllib.parse
from typing import Optional

from channels.auth import AuthMiddlewareStack
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.utils.functional import LazyObject
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


@database_sync_to_async
def get_user_from_token(token: str) -> Optional[User]:
    try:
        access = AccessToken(token)
        user_id = access.get('user_id')
        if not user_id:
            return None
        return User.objects.get(id=user_id)
    except Exception:
        return None


class JWTAuthMiddleware:
    """
    Custom Channels middleware that authenticates via JWT access token passed as
    a `token` query parameter on the WebSocket URL.
    Example: ws://host/ws/chat/<room_id>/?token=<ACCESS_TOKEN>
    """

    def __init__(self, inner):
        self.inner = inner

    def __call__(self, scope):
        return JWTAuthMiddlewareInstance(scope, self)


class JWTAuthMiddlewareInstance:
    def __init__(self, scope, middleware):
        self.scope = dict(scope)
        self.middleware = middleware

    async def __call__(self, receive, send):
        query_string = self.scope.get('query_string', b'').decode()
        params = urllib.parse.parse_qs(query_string)
        token = params.get('token', [None])[0]

        if token:
            user = await get_user_from_token(token)
            if user is not None:
                self.scope['user'] = user

        inner = self.middleware.inner
        return await inner(self.scope, receive, send)


# Convenience wrapper compatible with Channels' AuthMiddlewareStack usage
def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(AuthMiddlewareStack(inner))
