from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import SystemInfoSerializer

class SystemInfoAPIView(APIView):
    def post(self, request, *args, **kwargs):
        serializer = SystemInfoSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Data saved!"}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
