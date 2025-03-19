from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.core.cache import cache


class ValidationProgressView(APIView):
    """
    API view for retrieving progress information for validation and cleaning operations.
    Provides real-time updates on the progress of long-running validation and cleaning tasks.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get progress information for a validation or cleaning task
        """
        task_id = request.query_params.get('task_id')
        task_type = request.query_params.get(
            'type', 'validation')  # validation or cleaning

        if not task_id:
            return Response({
                'status': 'error',
                'message': 'Missing task_id parameter'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get progress information from cache
        progress_key = f"{task_type}_progress_{task_id}"
        progress_data = cache.get(progress_key)

        if not progress_data:
            return Response({
                'status': 'error',
                'message': f'No {task_type} task found with ID {task_id}'
            }, status=status.HTTP_404_NOT_FOUND)

        # Check if the task is complete and we should return results
        if progress_data.get('status') == 'complete':
            result_key = f"{task_type}_result_{task_id}"
            result_data = cache.get(result_key)

            if result_data:
                # Include result data with the response
                progress_data['result'] = result_data

        return Response(progress_data)
