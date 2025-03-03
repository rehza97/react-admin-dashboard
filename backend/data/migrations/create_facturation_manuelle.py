# Generated manually

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('data', '0001_initial'),  # Adjust this to your latest migration
    ]

    operations = [
        migrations.CreateModel(
            name='FacturationManuelle',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('month', models.CharField(blank=True, max_length=20, null=True)),
                ('invoice_date', models.DateField(blank=True, null=True)),
                ('department', models.CharField(
                    blank=True, max_length=20, null=True)),
                ('invoice_number', models.CharField(max_length=100)),
                ('fiscal_year', models.CharField(
                    blank=True, max_length=10, null=True)),
                ('client', models.CharField(blank=True, max_length=255, null=True)),
                ('amount_pre_tax', models.DecimalField(
                    decimal_places=2, max_digits=15, null=True)),
                ('vat_percentage', models.DecimalField(
                    decimal_places=2, max_digits=5, null=True)),
                ('vat_amount', models.DecimalField(
                    decimal_places=2, max_digits=15, null=True)),
                ('total_amount', models.DecimalField(
                    decimal_places=2, max_digits=15, null=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('period', models.CharField(blank=True, max_length=100, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('invoice', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                 related_name='facturation_manuelle_data', to='data.invoice')),
            ],
            options={
                'ordering': ['-invoice_date'],
                'indexes': [
                    models.Index(fields=['invoice'],
                                 name='data_factura_invoice_d0a4d0_idx'),
                    models.Index(fields=['fiscal_year'],
                                 name='data_factura_fiscal__1a9d30_idx'),
                    models.Index(fields=['department'],
                                 name='data_factura_departm_f8c1b9_idx'),
                    models.Index(fields=['invoice_number'],
                                 name='data_factura_invoice_e1c1a9_idx'),
                ],
            },
        ),
    ]
