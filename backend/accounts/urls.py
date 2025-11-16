from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, LoginView, logout_view, ProfileView, 
    firebase_custom_token, user_lookup, verify_email,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', logout_view, name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('users/lookup/', user_lookup, name='user_lookup'),
    path('firebase/custom-token/', firebase_custom_token, name='firebase_custom_token'),
    path('verify-email/', verify_email, name='verify_email'),
]
