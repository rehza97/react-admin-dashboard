import os
import logging
import pandas as pd
import json
from django.core.management.base import BaseCommand
from django.conf import settings

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Analyzes DOT data in an input file to understand its structure'

    def add_arguments(self, parser):
        parser.add_argument(
            'file_path',
            type=str,
            help='Path to the file to analyze',
        )
        parser.add_argument(
            '--output',
            type=str,
            help='Path to output analysis results (default: console output)',
            required=False,
        )
        parser.add_argument(
            '--sample-size',
            type=int,
            default=10,
            help='Number of sample records to show in the analysis',
        )
        parser.add_argument(
            '--separator',
            type=str,
            default=',',
            help='CSV separator character (default: comma)',
        )
        parser.add_argument(
            '--encoding',
            type=str,
            default='utf-8',
            help='File encoding (default: utf-8)',
        )

    def handle(self, *args, **options):
        file_path = options['file_path']
        output_path = options.get('output')
        sample_size = options.get('sample_size', 10)
        separator = options.get('separator', ',')
        encoding = options.get('encoding', 'utf-8')

        self.stdout.write(self.style.NOTICE(f"Analyzing file: {file_path}"))
        self.stdout.write(
            f"Using separator: '{separator}', encoding: {encoding}")

        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f"File not found: {file_path}"))
            return

        # Determine file type by extension
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()

        analysis_results = {
            'file_path': file_path,
            'file_size': os.path.getsize(file_path),
            'file_extension': ext,
            'dot_columns': [],
            'dot_samples': [],
            'stats': {}
        }

        try:
            # Load file based on extension
            df = None
            if ext == '.csv':
                # Try multiple encodings and separators if the first one fails
                encodings_to_try = [encoding, 'utf-8',
                                    'latin-1', 'iso-8859-1', 'cp1252']
                separators_to_try = [separator, ',', ';', '\t', '|']

                success = False
                errors = []

                # Try the specified encoding and separator first
                for enc in encodings_to_try:
                    if success:
                        break
                    for sep in separators_to_try:
                        try:
                            self.stdout.write(
                                f"Trying with separator: '{sep}', encoding: {enc}")
                            df = pd.read_csv(
                                file_path, sep=sep, encoding=enc, on_bad_lines='warn')
                            self.stdout.write(self.style.SUCCESS(
                                f"Successfully read file with separator: '{sep}', encoding: {enc}"))
                            analysis_results['detected_encoding'] = enc
                            analysis_results['detected_separator'] = sep
                            success = True
                            break
                        except Exception as e:
                            error_msg = f"Failed with separator: '{sep}', encoding: {enc}. Error: {str(e)}"
                            errors.append(error_msg)
                            self.stdout.write(self.style.WARNING(error_msg))

                if not success:
                    # If all attempts failed, try with the engine='python' parameter which is more forgiving
                    try:
                        self.stdout.write(
                            "Trying with Python engine (more forgiving)")
                        df = pd.read_csv(file_path, engine='python')
                        self.stdout.write(self.style.SUCCESS(
                            "Successfully read file with Python engine"))
                        analysis_results['detected_encoding'] = 'unknown'
                        analysis_results['detected_separator'] = 'auto-detected'
                        success = True
                    except Exception as e:
                        errors.append(f"Python engine failed. Error: {str(e)}")
                        self.stdout.write(self.style.ERROR(
                            f"Python engine failed. Error: {str(e)}"))

                if not success:
                    raise Exception(
                        f"Could not read CSV file after trying multiple options. Errors: {errors}")

            elif ext in ['.xlsx', '.xls']:
                try:
                    df = pd.read_excel(file_path)
                except Exception as e:
                    self.stdout.write(self.style.WARNING(
                        f"Error with default Excel reader: {str(e)}"))
                    self.stdout.write("Trying with openpyxl engine...")
                    df = pd.read_excel(file_path, engine='openpyxl')
            elif ext == '.json':
                with open(file_path, 'r', encoding=encoding) as f:
                    data = json.load(f)
                df = pd.DataFrame(data)
            else:
                self.stdout.write(self.style.ERROR(
                    f"Unsupported file type: {ext}"))
                return

            # Basic dataframe info
            analysis_results['row_count'] = len(df)
            analysis_results['column_count'] = len(df.columns)
            analysis_results['columns'] = df.columns.tolist()

            # Look for DOT related columns - more comprehensive search
            dot_columns = []
            for col in df.columns:
                col_upper = str(col).upper()
                if ('DOT' in col_upper or 'DO' == col_upper or
                    'CODE_DO' in col_upper.replace(' ', '_') or
                    'CODE DO' in col_upper or
                    'CODE_DOT' in col_upper.replace(' ', '_') or
                        'CODE DOT' in col_upper):
                    dot_columns.append(col)

            analysis_results['dot_columns'] = dot_columns

            # If no DOT columns found, search in the data itself
            if not dot_columns:
                self.stdout.write(self.style.WARNING(
                    "No explicit DOT columns found. Searching in data content..."))
                for col in df.columns:
                    try:
                        # Check if any text cell contains 'DOT:'
                        if df[col].dtype == 'object':
                            contains_dot = False
                            sample = df[col].dropna().head(100).astype(str)
                            for val in sample:
                                if 'DOT:' in val or 'DO:' in val:
                                    contains_dot = True
                                    break

                            if contains_dot:
                                self.stdout.write(self.style.NOTICE(
                                    f"Column '{col}' may contain DOT data"))
                                dot_columns.append(col)
                    except:
                        pass

                analysis_results['dot_columns'] = dot_columns
                analysis_results['dot_columns_found_in_content'] = True

            # Sample DOT values
            if dot_columns:
                for col in dot_columns:
                    # Get non-null values
                    try:
                        dot_values = df[col].dropna().astype(str).tolist()
                        if dot_values:
                            # Get sample values
                            samples = dot_values[:sample_size]
                            # Get value lengths
                            lengths = [len(str(val)) for val in dot_values]
                            # Count values exceeding 50 chars
                            long_values = [
                                val for val in dot_values if len(str(val)) > 50]

                            analysis_results['dot_samples'].append({
                                'column': col,
                                'samples': samples,
                                'value_count': len(dot_values),
                                'min_length': min(lengths) if lengths else 0,
                                'max_length': max(lengths) if lengths else 0,
                                'avg_length': sum(lengths) / len(lengths) if lengths else 0,
                                'long_values_count': len(long_values),
                                'unique_values_count': len(set(dot_values))
                            })

                            # If there are long values, show some examples
                            if long_values:
                                analysis_results['dot_samples'][-1]['long_value_examples'] = long_values[:5]
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(
                            f"Error processing column '{col}': {str(e)}"))

            # Analyze state field if it exists
            state_fields = [col for col in df.columns if 'STATE' in str(
                col).upper() or 'ETAT' in str(col).upper()]
            for state_field in state_fields:
                try:
                    state_values = df[state_field].dropna().astype(
                        str).tolist()
                    if state_values:
                        state_with_dot = [
                            val for val in state_values if 'DOT:' in val or 'DO:' in val]
                        analysis_results['stats'][f'state_field_{state_field}'] = {
                            'field_name': state_field,
                            'total_count': len(state_values),
                            'state_with_dot_count': len(state_with_dot),
                            'state_with_dot_percent': len(state_with_dot) / len(state_values) * 100 if state_values else 0,
                            'samples': state_values[:sample_size]
                        }
                except Exception as e:
                    self.stdout.write(self.style.ERROR(
                        f"Error analyzing state field '{state_field}': {str(e)}"))

            # Output the analysis
            if output_path:
                with open(output_path, 'w') as f:
                    json.dump(analysis_results, f, indent=2)
                self.stdout.write(self.style.SUCCESS(
                    f"Analysis saved to {output_path}"))
            else:
                # Print to console
                self.stdout.write(self.style.NOTICE("File Analysis:"))
                self.stdout.write(f"File: {file_path}")
                self.stdout.write(
                    f"Size: {analysis_results['file_size']} bytes")
                self.stdout.write(f"Type: {ext}")
                self.stdout.write(f"Rows: {analysis_results['row_count']}")
                self.stdout.write(
                    f"Columns: {analysis_results['column_count']}")

                self.stdout.write(self.style.NOTICE("\nDOT Columns Found:"))
                if dot_columns:
                    for col in dot_columns:
                        self.stdout.write(f"- {col}")
                else:
                    self.stdout.write("  No DOT columns found")

                if analysis_results['dot_samples']:
                    self.stdout.write(
                        self.style.NOTICE("\nDOT Data Analysis:"))
                    for sample in analysis_results['dot_samples']:
                        self.stdout.write(f"\nColumn: {sample['column']}")
                        self.stdout.write(
                            f"Value Count: {sample['value_count']}")
                        self.stdout.write(
                            f"Unique Values: {sample['unique_values_count']}")
                        self.stdout.write(
                            f"Min Length: {sample['min_length']}")
                        self.stdout.write(
                            f"Max Length: {sample['max_length']}")
                        self.stdout.write(
                            f"Avg Length: {sample['avg_length']:.2f}")
                        self.stdout.write(
                            f"Values > 50 chars: {sample['long_values_count']}")

                        self.stdout.write(self.style.NOTICE(
                            f"\nSample Values ({min(len(sample['samples']), sample_size)}):"))
                        for i, val in enumerate(sample['samples'][:sample_size], 1):
                            self.stdout.write(
                                f"{i}. '{val}' (length: {len(str(val))})")

                        if 'long_value_examples' in sample and sample['long_value_examples']:
                            self.stdout.write(self.style.WARNING(
                                "\nLong Value Examples:"))
                            for i, val in enumerate(sample['long_value_examples'], 1):
                                self.stdout.write(
                                    f"{i}. '{val[:30]}...' (length: {len(str(val))})")

                # Show state field analysis
                state_field_keys = [k for k in analysis_results.get(
                    'stats', {}).keys() if k.startswith('state_field_')]
                if state_field_keys:
                    for key in state_field_keys:
                        state_stats = analysis_results['stats'][key]
                        self.stdout.write(self.style.NOTICE(
                            f"\nState Field Analysis ({state_stats['field_name']}):"))
                        self.stdout.write(
                            f"Total States: {state_stats['total_count']}")
                        self.stdout.write(
                            f"States with DOT info: {state_stats['state_with_dot_count']} ({state_stats['state_with_dot_percent']:.2f}%)")

                        self.stdout.write(self.style.NOTICE(
                            "\nState Field Samples:"))
                        for i, val in enumerate(state_stats['samples'], 1):
                            self.stdout.write(f"{i}. '{val}'")

        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f"Error analyzing file: {str(e)}"))
            logger.exception("Error in analyze_dot_data command")
            return

        self.stdout.write(self.style.SUCCESS("Analysis complete"))
