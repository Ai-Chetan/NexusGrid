from django.db import models

class LayoutItem(models.Model):
    ITEM_TYPES = [
        ('building', 'Building'),
        ('floor', 'Floor'),
        ('room', 'Room'),
        ('computer', 'Computer'),
        ('server', 'Server'),
        ('network_switch', 'Network Switch'),
        ('router', 'Router'),
        ('printer', 'Printer'),
        ('ups', 'UPS'),
        ('rack', 'Server Rack'),
    ]
    
    name = models.CharField(max_length=100)
    item_type = models.CharField(max_length=20, choices=ITEM_TYPES)
    x_position = models.IntegerField(default=0)
    y_position = models.IntegerField(default=0)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    
    def __str__(self):
        return f"{self.name} ({self.get_item_type_display()})"