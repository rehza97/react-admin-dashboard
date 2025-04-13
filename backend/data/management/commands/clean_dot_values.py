from django.core.management.base import BaseCommand
from data.models import ParcCorporate, DOT
from data.utils import clean_dot_value
from django.db import transaction


class Command(BaseCommand):
    help = 'Clean DOT values in the database by replacing underscores with spaces'

    def handle(self, *args, **options):
        self.stdout.write('Starting DOT value cleanup...')

        # First clean DOT model values
        with transaction.atomic():
            dots_updated = 0
            for dot in DOT.objects.all():
                old_name = dot.name
                new_name = clean_dot_value(old_name)
                if old_name != new_name:
                    dot.name = new_name
                    dot.save()
                    dots_updated += 1
                    self.stdout.write(
                        f'Updated DOT name from "{old_name}" to "{new_name}"')

            self.stdout.write(f'Updated {dots_updated} DOT names')

        # Then clean ParcCorporate DOT codes
        with transaction.atomic():
            codes_updated = 0
            for parc in ParcCorporate.objects.all():
                if parc.dot_code:
                    old_code = parc.dot_code
                    new_code = clean_dot_value(old_code)
                    if old_code != new_code:
                        parc.dot_code = new_code
                        parc.save()
                        codes_updated += 1
                        if codes_updated % 1000 == 0:  # Log every 1000 updates
                            self.stdout.write(
                                f'Updated {codes_updated} DOT codes so far...')

            self.stdout.write(
                f'Updated {codes_updated} DOT codes in ParcCorporate records')

        self.stdout.write(self.style.SUCCESS(
            'Successfully cleaned all DOT values'))
