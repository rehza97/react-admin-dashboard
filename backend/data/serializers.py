from rest_framework import serializers
from .models import FacturationAR, FacturationManuelle


class FacturationARSerializer(serializers.ModelSerializer):
    upload_date = serializers.DateTimeField(source='created_at', read_only=True)
    file_size = serializers.SerializerMethodField()
    
    class Meta:
        model = FacturationAR
        fields = [
            'id', 
            'invoice_number', 
            'client_name', 
            'amount', 
            'invoice_date', 
            'status', 
            'upload_date', 
            'file_size'
        ]
    
    def get_file_size(self, obj):
        # You could implement actual file size calculation here if needed
        return 0

class FacturationManuelleSerializer(serializers.ModelSerializer):
    class Meta:
        model = FacturationManuelle
        fields = '__all__' 