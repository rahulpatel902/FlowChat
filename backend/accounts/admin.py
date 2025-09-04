from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'username', 'first_name', 'last_name', 'is_online', 'last_seen', 'is_staff')
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'is_online', 'created_at')
    search_fields = ('email', 'username', 'first_name', 'last_name')
    ordering = ('email',)
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Profile Info', {
            'fields': ('bio', 'profile_picture', 'is_online', 'last_seen')
        }),
    )
    
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Profile Info', {
            'fields': ('email', 'first_name', 'last_name', 'bio')
        }),
    )
