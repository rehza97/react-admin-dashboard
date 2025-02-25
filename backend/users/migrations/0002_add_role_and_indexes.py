from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('users', '0001_initial'),  # Make sure this matches your last migration
    ]

    operations = [
        # Add role field
        migrations.AddField(
            model_name='customuser',
            name='role',
            field=models.CharField(
                choices=[
                    ('admin', 'Administrator'),
                    ('analyst', 'Analyst'),
                    ('viewer', 'Viewer')
                ],
                default='viewer',
                max_length=20,
                db_index=True
            ),
        ),
        # Add indexes
        migrations.AddIndex(
            model_name='customuser',
            index=models.Index(fields=['email', 'role'], name='users_email_role_idx'),
        ),
        migrations.AddIndex(
            model_name='customuser',
            index=models.Index(fields=['-date_joined'], name='users_date_joined_idx'),
        ),
    ] 