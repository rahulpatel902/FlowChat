from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from decouple import config
import uuid

User = get_user_model()

class Command(BaseCommand):
    help = 'Create a superuser for production deployment'

    def handle(self, *args, **options):
        email = config('SUPERUSER_EMAIL', default='admin@flowchat.com')
        password = config('SUPERUSER_PASSWORD', default='admin123')
        
        # Check if superuser already exists by email
        if User.objects.filter(email=email).exists():
            self.stdout.write(
                self.style.WARNING(f'Superuser with email {email} already exists')
            )
            return
        
        # Check if username 'admin' exists, if so create unique username
        username = 'admin'
        if User.objects.filter(username=username).exists():
            username = f'admin_{str(uuid.uuid4())[:8]}'
        
        try:
            User.objects.create_superuser(
                email=email,
                password=password,
                username=username,
                first_name='Admin',
                last_name='User'
            )
            self.stdout.write(
                self.style.SUCCESS(f'Superuser created successfully with email: {email} and username: {username}')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating superuser: {str(e)}')
            )
