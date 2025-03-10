from django.db import migrations


def copy_dot_to_dot_code(apps, schema_editor):
    """
    Copy the existing dot field values to the new dot_code field
    """
    CreancesNGBSS = apps.get_model('data', 'CreancesNGBSS')
    CAPeriodique = apps.get_model('data', 'CAPeriodique')
    CANonPeriodique = apps.get_model('data', 'CANonPeriodique')
    CADNT = apps.get_model('data', 'CADNT')
    CARFD = apps.get_model('data', 'CARFD')
    CACNT = apps.get_model('data', 'CACNT')
    NGBSSCollection = apps.get_model('data', 'NGBSSCollection')
    UnfinishedInvoice = apps.get_model('data', 'UnfinishedInvoice')
    RevenueObjective = apps.get_model('data', 'RevenueObjective')
    CollectionObjective = apps.get_model('data', 'CollectionObjective')

    # Helper function to copy dot to dot_code
    def copy_field(model):
        for obj in model.objects.all():
            # Get the original dot field value
            original_dot = getattr(obj, 'dot', None)
            if original_dot and not obj.dot_code:
                obj.dot_code = original_dot
                obj.save(update_fields=['dot_code'])

    # Copy dot to dot_code for all models
    copy_field(CreancesNGBSS)
    copy_field(CAPeriodique)
    copy_field(CANonPeriodique)
    copy_field(CADNT)
    copy_field(CARFD)
    copy_field(CACNT)
    copy_field(NGBSSCollection)
    copy_field(UnfinishedInvoice)
    copy_field(RevenueObjective)
    copy_field(CollectionObjective)


def populate_dot_foreign_keys(apps, schema_editor):
    """
    Populate the new DOT foreign key fields from the dot_code fields
    """
    DOT = apps.get_model('data', 'DOT')
    CreancesNGBSS = apps.get_model('data', 'CreancesNGBSS')
    CAPeriodique = apps.get_model('data', 'CAPeriodique')
    CANonPeriodique = apps.get_model('data', 'CANonPeriodique')
    CADNT = apps.get_model('data', 'CADNT')
    CARFD = apps.get_model('data', 'CARFD')
    CACNT = apps.get_model('data', 'CACNT')
    NGBSSCollection = apps.get_model('data', 'NGBSSCollection')
    UnfinishedInvoice = apps.get_model('data', 'UnfinishedInvoice')
    RevenueObjective = apps.get_model('data', 'RevenueObjective')
    CollectionObjective = apps.get_model('data', 'CollectionObjective')

    # Get all DOT codes from the existing models
    dot_codes = set()

    # Helper function to extract DOT codes from a model
    def extract_dot_codes(model):
        codes = model.objects.exclude(dot_code__isnull=True).exclude(
            dot_code='').values_list('dot_code', flat=True).distinct()
        dot_codes.update(codes)

    # Extract DOT codes from all models
    extract_dot_codes(CreancesNGBSS)
    extract_dot_codes(CAPeriodique)
    extract_dot_codes(CANonPeriodique)
    extract_dot_codes(CADNT)
    extract_dot_codes(CARFD)
    extract_dot_codes(CACNT)
    extract_dot_codes(NGBSSCollection)
    extract_dot_codes(UnfinishedInvoice)
    extract_dot_codes(RevenueObjective)
    extract_dot_codes(CollectionObjective)

    # Create DOT objects for each unique code
    dot_objects = {}
    for code in dot_codes:
        if code:
            dot, created = DOT.objects.get_or_create(
                code=code, defaults={'name': code})
            dot_objects[code] = dot

    # Helper function to update foreign keys in a model
    def update_foreign_keys(model):
        for obj in model.objects.all():
            if obj.dot_code and obj.dot_code in dot_objects:
                obj.dot = dot_objects[obj.dot_code]
                obj.save(update_fields=['dot'])

    # Update foreign keys in all models
    update_foreign_keys(CreancesNGBSS)
    update_foreign_keys(CAPeriodique)
    update_foreign_keys(CANonPeriodique)
    update_foreign_keys(CADNT)
    update_foreign_keys(CARFD)
    update_foreign_keys(CACNT)
    update_foreign_keys(NGBSSCollection)
    update_foreign_keys(UnfinishedInvoice)
    update_foreign_keys(RevenueObjective)
    update_foreign_keys(CollectionObjective)


class Migration(migrations.Migration):

    dependencies = [
        ('data', '0011_add_dot_foreign_keys'),
    ]

    operations = [
        migrations.RunPython(copy_dot_to_dot_code, migrations.RunPython.noop),
        migrations.RunPython(populate_dot_foreign_keys,
                             migrations.RunPython.noop),
    ]
