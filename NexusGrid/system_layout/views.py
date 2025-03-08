from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from .models import Block

def system_layout(request):
    blocks = Block.objects.all()
    return render(request, "system-layout/system-layout.html", {"blocks": blocks})

def add_block(request):
    if request.method == "POST":
        x = request.POST.get("x", 0)
        y = request.POST.get("y", 0)
        block = Block.objects.create(x=x, y=y)
        return JsonResponse({"id": block.id, "x": block.x, "y": block.y})

    return JsonResponse({"error": "Invalid request"}, status=400)

def update_block(request, block_id):
    block = get_object_or_404(Block, id=block_id)
    x = request.GET.get("x")
    y = request.GET.get("y")
    
    if x is not None and y is not None:
        block.x, block.y = int(x), int(y)
        block.save()
    
    return JsonResponse({"status": "updated"})

def remove_block(request, block_id):
    block = get_object_or_404(Block, id=block_id)
    block.delete()
    return JsonResponse({"status": "deleted"})