# models.py - Fixed version
from django.db import models
from login_manager.models import User
import json

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

    name = models.CharField(max_length=100, db_index=True)
    item_type = models.CharField(max_length=20, choices=ITEM_TYPES, db_index=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
        db_index=True
    )

    position_x = models.PositiveIntegerField(default=0)
    position_y = models.PositiveIntegerField(default=0)
    width = models.PositiveIntegerField(default=1)
    height = models.PositiveIntegerField(default=1)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['item_type', 'name']

    def __str__(self):
        return f"{self.name} ({self.get_item_type_display()})"

    def to_dict(self):
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
        ancestors = []
        current = self.parent
        while current:
            ancestors.insert(0, current)
            current = current.parent
        return ancestors


class Lab(models.Model):
    layout_item = models.OneToOneField(LayoutItem, on_delete=models.CASCADE, limit_choices_to={'item_type': 'room'}, related_name='lab' )
    lab_name = models.CharField(max_length=100)
    location = models.CharField(max_length=100, null=True)
    instructors = models.ManyToManyField(User, blank=True, related_name='instructor_labs')
    assistants = models.ManyToManyField(User, blank=True, related_name='assistant_labs')
    capacity = models.IntegerField(null=True)
    dimension = models.CharField(max_length=50, null=True)
    parent = models.ForeignKey(LayoutItem, on_delete=models.CASCADE, related_name='lab_children' )
    quick_info = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.lab_name

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['lab_name', 'parent'],
                name='unique_lab_name_per_floor'
            )
        ]

    def save(self, *args, **kwargs):
        # Automatically set parent to the parent of the layout_item (the floor)
        if self.layout_item and self.layout_item.parent:
            self.parent = self.layout_item.parent
        else:
            self.parent = None
        super().save(*args, **kwargs)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.lab_name,
            'location': self.location,
            'capacity': self.capacity,
            'dimension': self.dimension,
            'instructors': [{'id': u.id, 'username': u.username} for u in self.instructors.all()],
            'assistants': [{'id': u.id, 'username': u.username} for u in self.assistants.all()],
        }
    
    def get_quick_info(self):
        try:
            return json.loads(self.quick_info) if self.quick_info else {}
        except json.JSONDecodeError:
            return {}

class System(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active (System is turned on)'),
        ('inactive', 'Inactive (Turned off but functional)'),
        ('non-functional', 'Non-Functional (Needs repair or replacement)'),
    ]

    layout_item = models.OneToOneField(
        LayoutItem,
        on_delete=models.CASCADE,
        related_name='system',
        limit_choices_to={'item_type__in': ['computer', 'server', 'network_switch', 'router', 'printer', 'ups', 'rack']},
        unique=True,
        null=True
    )
    lab = models.ForeignKey(
        Lab,
        on_delete=models.CASCADE,
        db_index=True
    )

    host_name = models.TextField(null=True, blank=True, default="")

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        null=True,
        blank=True
    )
    updated_at = models.DateTimeField(null=True, blank=True)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"{self.host_name or self.layout_item.name} - {self.get_status_display()}"