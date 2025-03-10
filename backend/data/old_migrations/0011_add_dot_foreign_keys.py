from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('data', '0010_dot_model'),
    ]

    operations = [
        # Add dot_code field to all models for backward compatibility
        migrations.AddField(
            model_name='creancesngbss',
            name='dot_code',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='caperiodique',
            name='dot_code',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='canonperiodique',
            name='dot_code',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='cadnt',
            name='dot_code',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='carfd',
            name='dot_code',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='cacnt',
            name='dot_code',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='ngbsscollection',
            name='dot_code',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='unfinishedinvoice',
            name='dot_code',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='revenueobjective',
            name='dot_code',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='collectionobjective',
            name='dot_code',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),

        # Add foreign key fields to all models
        migrations.AddField(
            model_name='creancesngbss',
            name='dot',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                    related_name='creances_ngbss_data', to='data.dot', verbose_name='DOT'),
        ),
        migrations.AddField(
            model_name='caperiodique',
            name='dot',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                    related_name='ca_periodique_data', to='data.dot', verbose_name='DOT'),
        ),
        migrations.AddField(
            model_name='canonperiodique',
            name='dot',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                    related_name='ca_non_periodique_data', to='data.dot', verbose_name='DOT'),
        ),
        migrations.AddField(
            model_name='cadnt',
            name='dot',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                    related_name='ca_dnt_data', to='data.dot', verbose_name='DOT'),
        ),
        migrations.AddField(
            model_name='carfd',
            name='dot',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                    related_name='ca_rfd_data', to='data.dot', verbose_name='DOT'),
        ),
        migrations.AddField(
            model_name='cacnt',
            name='dot',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                    related_name='ca_cnt_data', to='data.dot', verbose_name='DOT'),
        ),
        migrations.AddField(
            model_name='ngbsscollection',
            name='dot',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                    related_name='ngbss_collections', to='data.dot', verbose_name='DOT'),
        ),
        migrations.AddField(
            model_name='unfinishedinvoice',
            name='dot',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                    related_name='unfinished_invoices', to='data.dot', verbose_name='DOT'),
        ),
        migrations.AddField(
            model_name='revenueobjective',
            name='dot',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE,
                                    related_name='revenue_objectives', to='data.dot', verbose_name='DOT'),
        ),
        migrations.AddField(
            model_name='collectionobjective',
            name='dot',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE,
                                    related_name='collection_objectives', to='data.dot', verbose_name='DOT'),
        ),
    ]
