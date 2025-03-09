from django.shortcuts import render, get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from .models import Block
import json

def system_layout(request):
    """Render the system layout page with saved blocks."""
    blocks = Block.objects.all()
    return render(request, "system-layout/system-layout.html", {"blocks": blocks})

@csrf_exempt
def add_block(request):
    """Add a new block with default or provided coordinates."""
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            x = data.get("x", 0)
            y = data.get("y", 0)
            block = Block.objects.create(x=x, y=y)
            return JsonResponse({"id": block.id, "x": block.x, "y": block.y}, status=201)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON data"}, status=400)
    
    return JsonResponse({"error": "Invalid request"}, status=400)

@csrf_exempt
def update_block(request, block_id):
    """Update the position of an existing block."""
    block = get_object_or_404(Block, id=block_id)
    
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            x = data.get("x")
            y = data.get("y")

            if x is not None and y is not None:
                block.x, block.y = int(x), int(y)
                block.save()
                return JsonResponse({"status": "updated", "id": block.id, "x": block.x, "y": block.y})
            
            return JsonResponse({"error": "Missing x or y"}, status=400)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON data"}, status=400)

    return JsonResponse({"error": "Invalid request"}, status=400)

@csrf_exempt
def remove_block(request, block_id):
    """Remove a block by its ID."""
    if request.method == "DELETE":
        block = get_object_or_404(Block, id=block_id)
        block.delete()
        return JsonResponse({"status": "deleted", "id": block_id})
    
    return JsonResponse({"error": "Invalid request"}, status=400)

def get_blocks(request):
    blocks = list(Block.objects.values())  # Fetch all saved blocks
    return JsonResponse({"blocks": blocks})  # Ensure correct JSON format

@csrf_exempt
def save_blocks(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            Block.objects.all().delete()  # Clear old blocks
            for block in data["blocks"]:
                Block.objects.create(x=block["x"], y=block["y"])
            return JsonResponse({"status": "success"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)