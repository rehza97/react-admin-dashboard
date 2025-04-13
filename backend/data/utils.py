def clean_dot_value(dot_value):
    """
    Clean DOT value by replacing underscores with spaces and standardizing format
    """
    if not dot_value:
        return dot_value

    # Convert to string if not already
    dot_value = str(dot_value).strip()

    # Replace underscores with spaces
    dot_value = dot_value.replace('_', ' ')

    # Handle special cases
    dot_value = dot_value.replace('  ', ' ')  # Remove double spaces

    return dot_value
