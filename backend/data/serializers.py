from rest_framework import serializers
from .models import FacturationAR, FacturationManuelle

class FacturationARSerializer(serializers.ModelSerializer):
    class Meta:
        model = FacturationAR
        fields = '__all__'

class FacturationManuelleSerializer(serializers.ModelSerializer):
    class Meta:
        model = FacturationManuelle
        fields = '__all__' 