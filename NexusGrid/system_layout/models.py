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

    name = models.CharField(max_length=100, db_index=True)  # Index for faster lookups
    item_type = models.CharField(max_length=20, choices=ITEM_TYPES, db_index=True)  # Index choices
    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True, related_name='children', db_index=True
    )
    position_x = models.PositiveIntegerField(default=0)  # No negative values
    position_y = models.PositiveIntegerField(default=0)  
    width = models.PositiveIntegerField(default=1)  
    height = models.PositiveIntegerField(default=1)  
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.get_item_type_display()})"

    def to_dict(self):
        """Return item as dictionary for JSON responses"""
        return {
            'id': self.id,
            'name': self.name,
            'item_type': self.item_type,
            'position_x': self.position_x,
            'position_y': self.position_y,
            'width': self.width,
            'height': self.height,
        }

    def get_ancestors(self):
        """Return all ancestors in order from root to parent"""
        ancestors = []
        current = self.parent
        while current:
            ancestors.insert(0, current)
            current = current.parent
        return ancestors

    class Meta:
        ordering = ['item_type', 'name']
