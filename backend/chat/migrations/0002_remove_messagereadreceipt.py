# Generated migration to remove MessageReadReceipt model

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0001_initial'),
    ]

    operations = [
        migrations.DeleteModel(
            name='MessageReadReceipt',
        ),
    ]
