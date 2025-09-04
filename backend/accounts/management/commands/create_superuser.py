from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from decouple import config

User = get_user_model()

class Command(BaseCommand):
    help = 'Create a superuser for production deployment'

    def handle(self, *args, **options):
        email = config('SUPERUSER_EMAIL', default='admin@flowchat.com')
        password = config('SUPERUSER_PASSWORD', default='admin123')
        
        if not User.objects.filter(email=email).exists():
            User.objects.create_superuser(
                email=email,
                password=password,
                username='admin',
                first_name='Admin',
                last_name='User'
            )
            self.stdout.write(
                self.style.SUCCESS(f'Superuser created successfully with email: {email}')
            )
        else:
            self.stdout.write(
                self.style.WARNING(f'Superuser with email {email} already exists')
            )
