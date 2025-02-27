from rest_framework import serializers
from .models import Invoice

class InvoiceSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    file_size = serializers.SerializerMethodField()
    uploaded_by = serializers.ReadOnlyField(source='uploaded_by.email')

    class Meta:
        model = Invoice
        fields = [
            'id', 
            'invoice_number', 
            'file',
            'file_url', 
            'file_size',
            'uploaded_by',
            'upload_date', 
            'status'
        ]
        read_only_fields = ['upload_date', 'status', 'uploaded_by']

    def get_file_url(self, obj):
        if obj.file:
            return self.context['request'].build_absolute_uri(obj.file.url)
        return None

    def get_file_size(self, obj):
        if obj.file:
            return obj.file.size
        return 0

    def create(self, validated_data):
        # Set the uploaded_by field to the current user
        validated_data['uploaded_by'] = self.context['request'].user
        return super().create(validated_data)




