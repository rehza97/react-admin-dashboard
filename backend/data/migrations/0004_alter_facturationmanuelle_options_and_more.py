# Generated by Django 5.1.5 on 2025-03-18 00:59

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('data', '0003_remove_anomaly_test'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='facturationmanuelle',
            options={'ordering': ['-created_at']},
        ),
        migrations.RemoveIndex(
            model_name='facturationmanuelle',
            name='data_factur_invoice_363ff7_idx',
        ),
        migrations.RemoveIndex(
            model_name='facturationmanuelle',
            name='data_factur_invoice_9e7310_idx',
        ),
        migrations.RemoveField(
            model_name='facturationmanuelle',
            name='client',
        ),
        migrations.RemoveField(
            model_name='facturationmanuelle',
            name='invoice_date',
        ),
        migrations.RemoveField(
            model_name='facturationmanuelle',
            name='invoice_number',
        ),
        migrations.RemoveField(
            model_name='facturationmanuelle',
            name='month',
        ),
        migrations.RemoveField(
            model_name='facturationmanuelle',
            name='period',
        ),
        migrations.RemoveField(
            model_name='facturationmanuelle',
            name='total_amount',
        ),
        migrations.RemoveField(
            model_name='facturationmanuelle',
            name='vat_amount',
        ),
        migrations.RemoveField(
            model_name='facturationmanuelle',
            name='vat_percentage',
        ),
    ]
