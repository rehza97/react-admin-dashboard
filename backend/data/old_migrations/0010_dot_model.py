from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('data', '0009_ngbsscollection_unfinishedinvoice'),
    ]

    operations = [
        migrations.CreateModel(
            name='DOT',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=10, unique=True)),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['code'],
                'indexes': [
                    models.Index(fields=['code'], name='data_dot_code_idx'),
                    models.Index(fields=['is_active'],
                                 name='data_dot_is_active_idx'),
                ],
            },
        ),
    ]
