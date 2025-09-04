from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from decouple import config, UndefinedValueError
import uuid

User = get_user_model()

class Command(BaseCommand):
    help = 'Create a superuser for production deployment'

    def handle(self, *args, **options):
        try:
            email = config('SUPERUSER_EMAIL')
            password = config('SUPERUSER_PASSWORD')
            desired_username = config('SUPERUSER_USERNAME')
            first_name = config('SUPERUSER_FIRST_NAME')
            last_name = config('SUPERUSER_LAST_NAME')
        except UndefinedValueError as e:
            self.stdout.write(
                self.style.ERROR(
                    'Missing required environment variables for superuser creation. '
                    'Please set SUPERUSER_EMAIL, SUPERUSER_PASSWORD, SUPERUSER_USERNAME, '
                    'SUPERUSER_FIRST_NAME, and SUPERUSER_LAST_NAME.'
                )
            )
            return
        
        # Check if superuser already exists by email
        if User.objects.filter(email=email).exists():
            self.stdout.write(
                self.style.WARNING(f'Superuser with email {email} already exists')
            )
            return
        
        # Ensure username uniqueness; if desired username exists, append short UUID
        username = desired_username
        if User.objects.filter(username=username).exists():
            username = f"{desired_username}_{str(uuid.uuid4())[:8]}"
        
        try:
            User.objects.create_superuser(
                email=email,
                password=password,
                username=username,
                first_name=first_name,
                last_name=last_name
            )
            self.stdout.write(
                self.style.SUCCESS(f'Superuser created successfully with email: {email} and username: {username}')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating superuser: {str(e)}')
            )
