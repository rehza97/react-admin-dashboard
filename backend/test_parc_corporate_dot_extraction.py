from data.v2.views import APIProcessInvoiceView
from data.models import DOT, ParcCorporate
import django
import os
import sys
import logging

# Set up Django environment
# Change to your actual settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'your_settings_module')
django.setup()

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Import your models and other dependencies


def test_dot_extraction():
    """Test DOT extraction logic from ParcCorporate data"""
    print("Testing DOT extraction for ParcCorporate data")

    # Create a sample row with various fields
    sample_rows = [
        # Row with explicit DOT field
        {
            'DOT': 'ALG',
            'ACTEL_CODE': '12345',
            'DESCRIPTION_CUSTOMER_L1': 'Some organization',
            'STATE': 'Active'
        },
        # Row with DOT_CODE field
        {
            'DOT_CODE': 'ORA',
            'ACTEL_CODE': '67890',
            'DESCRIPTION_CUSTOMER_L1': 'Another org',
            'STATE': 'Active'
        },
        # Row with organization name pattern
        {
            'ACTEL_CODE': '13579',
            'DESCRIPTION_CUSTOMER_L1': 'DOT_ALGER',
            'STATE': 'Active'
        },
        # Row with organization name that maps to DOT
        {
            'ACTEL_CODE': '24680',
            'DESCRIPTION_CUSTOMER_L1': 'CONSTANTINE',
            'STATE': 'Active'
        }
    ]

    view = APIProcessInvoiceView()

    for idx, row in enumerate(sample_rows):
        print(f"\nTesting row {idx+1}:")
        for key, value in row.items():
            print(f"  {key}: {value}")

        # Get state and initialize dot_code
        state = row.get('STATE', '')

        # Initialize the dot_field_mapping
        dot_field_mapping = {
            'dot': 'DOT', 'do': 'DOT', 'dot_code': 'DOT', 'dotcode': 'DOT',
            'code_dot': 'DOT', 'department': 'DOT', 'dept': 'DOT', 'direction': 'DOT',
            'DOT': 'DOT', 'DO': 'DOT', 'DOT_CODE': 'DOT', 'DEPARTMENT': 'DOT',
            'DIRECTION': 'DOT', 'DEPT': 'DOT'
        }

        # Organization to DOT mapping
        org_to_dot_mapping = {
            'AT_SIEGE': 'SIE', 'SIEGE': 'SIE', 'SIEGE_DG': 'SIE',
            'DOT_ADRAR': 'ADR', 'ADRAR': 'ADR',
            'DOT_AIN_DEFLA': 'ADF', 'AIN_DEFLA': 'ADF', 'AIN DEFLA': 'ADF',
            'DOT_ALGER': 'ALG', 'ALGER': 'ALG', 'DOT_ALGER_CENTRE': 'ALG', 'ALGER_CENTRE': 'ALG', 'ALGER CENTRE': 'ALG',
            'DOT_ANNABA': 'ANN', 'ANNABA': 'ANN',
            'DOT_BATNA': 'BAT', 'BATNA': 'BAT',
            'DOT_BECHAR': 'BCH', 'BECHAR': 'BCH',
            'DOT_BEJAIA': 'BJA', 'BEJAIA': 'BJA',
            'DOT_BISKRA': 'BIS', 'BISKRA': 'BIS',
            'DOT_BLIDA': 'BLI', 'BLIDA': 'BLI',
            'DOT_BOUIRA': 'BOU', 'BOUIRA': 'BOU',
            'DOT_BOUMERDES': 'BMD', 'BOUMERDES': 'BMD',
            'DOT_BORDJ_BOU_ARRERIDJ': 'BBA', 'BORDJ_BOU_ARRERIDJ': 'BBA', 'BORDJ BOU ARRERIDJ': 'BBA',
            'DOT_CHLEF': 'CHL', 'CHLEF': 'CHL',
            'DOT_CONSTANTINE': 'CON', 'CONSTANTINE': 'CON',
            'DOT_DJELFA': 'DJE', 'DJELFA': 'DJE',
            'DOT_EL_BAYADH': 'BAY', 'EL_BAYADH': 'BAY', 'EL BAYADH': 'BAY',
            'DOT_EL_OUED': 'OUD', 'EL_OUED': 'OUD', 'EL OUED': 'OUD',
            'DOT_GHARDAIA': 'GHA', 'GHARDAIA': 'GHA',
            'DOT_GUELMA': 'GUE', 'GUELMA': 'GUE',
            'DOT_ILLIZI': 'ILL', 'ILLIZI': 'ILL',
            'DOT_JIJEL': 'JIJ', 'JIJEL': 'JIJ',
            'DOT_KHENCHELA': 'KHE', 'KHENCHELA': 'KHE',
            'DOT_LAGHOUAT': 'LAG', 'LAGHOUAT': 'LAG',
            'DOT_MASCARA': 'MAS', 'MASCARA': 'MAS',
            'DOT_MEDEA': 'MED', 'MEDEA': 'MED',
            'DOT_MILA': 'MIL', 'MILA': 'MIL',
            'DOT_MOSTAGANEM': 'MOS', 'MOSTAGANEM': 'MOS',
            'DOT_MSILA': 'MSI', 'MSILA': 'MSI',
            'DOT_NAAMA': 'NAA', 'NAAMA': 'NAA',
            'DOT_ORAN': 'ORA', 'ORAN': 'ORA',
            'DOT_OUARGLA': 'OUA', 'OUARGLA': 'OUA',
            'DOT_OUM_EL_BOUAGHI': 'OEB', 'OUM_EL_BOUAGHI': 'OEB', 'OUM EL BOUAGHI': 'OEB',
            'DOT_RELIZANE': 'REL', 'RELIZANE': 'REL',
            'DOT_SAIDA': 'SAI', 'SAIDA': 'SAI',
            'DOT_SETIF': 'SET', 'SETIF': 'SET',
            'DOT_SIDI_BEL_ABBES': 'SBA', 'SIDI_BEL_ABBES': 'SBA', 'SIDI BEL ABBES': 'SBA',
            'DOT_SKIKDA': 'SKI', 'SKIKDA': 'SKI',
            'DOT_SOUK_AHRAS': 'SAH', 'SOUK_AHRAS': 'SAH', 'SOUK AHRAS': 'SAH',
            'DOT_TAMANRASSET': 'TAM', 'TAMANRASSET': 'TAM',
            'DOT_TEBESSA': 'TEB', 'TEBESSA': 'TEB',
            'DOT_TIARET': 'TIA', 'TIARET': 'TIA',
            'DOT_TINDOUF': 'TIN', 'TINDOUF': 'TIN',
            'DOT_TIPAZA': 'TIP', 'TIPAZA': 'TIP',
            'DOT_TISSEMSILT': 'TIS', 'TISSEMSILT': 'TIS',
            'DOT_TIZI_OUZOU': 'TZO', 'TIZI_OUZOU': 'TZO', 'TIZI OUZOU': 'TZO',
            'DOT_TLEMCEN': 'TLE', 'TLEMCEN': 'TLE'
        }

        # Try to find DOT code from various field names
        dot_code = None
        for field_key, standard_key in dot_field_mapping.items():
            if field_key.upper() in row and row[field_key.upper()]:
                dot_code = row[field_key.upper()]
                print(
                    f"  Found DOT code '{dot_code}' from field '{field_key.upper()}'")
                break
            elif field_key in row and row[field_key]:
                dot_code = row[field_key]
                print(
                    f"  Found DOT code '{dot_code}' from field '{field_key}'")
                break

        # Try to extract DOT from organization if no DOT code found
        if not dot_code and 'DESCRIPTION_CUSTOMER_L1' in row and row['DESCRIPTION_CUSTOMER_L1']:
            org_value = row['DESCRIPTION_CUSTOMER_L1']
            # Check if org value is in our mapping
            if org_value in org_to_dot_mapping:
                dot_code = org_to_dot_mapping[org_value]
                print(
                    f"  Mapped organization '{org_value}' to DOT code '{dot_code}'")
            # Try to extract DOT code from org name if it follows a pattern
            elif org_value.startswith('DOT_') or org_value.startswith('AT_'):
                potential_code = org_value.split(
                    '_')[1] if '_' in org_value else ''
                if potential_code and potential_code in org_to_dot_mapping.values():
                    dot_code = potential_code
                    print(
                        f"  Extracted DOT code '{dot_code}' from organization '{org_value}'")

        print(f"  Final DOT code: {dot_code}")
        # In a real scenario, we would create a DOT instance and save the record


if __name__ == "__main__":
    test_dot_extraction()
