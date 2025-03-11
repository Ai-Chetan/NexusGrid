from django.db import models
from django.db.models import Count
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils.text import slugify
from django.core.cache import cache
import uuid

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
    
    # Hierarchical relationship types for validation
    VALID_PARENT_CHILD_RELATIONSHIPS = {
        None: ['building'],
        'building': ['floor'],
        'floor': ['room'],
        'room': ['computer', 'server', 'network_switch', 'router', 'printer', 'ups', 'rack'],
    }
    
    name = models.CharField(max_length=100, db_index=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    item_type = models.CharField(max_length=20, choices=ITEM_TYPES, db_index=True)
    x_position = models.IntegerField(default=0)
    y_position = models.IntegerField(default=0)
    parent = models.ForeignKey(
        'self', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='children',
        db_index=True
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    
    # Optional extended attributes through generic relations
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    properties = GenericForeignKey('content_type', 'object_id')
    
    class Meta:
        indexes = [
            models.Index(fields=['parent', 'item_type']),
            models.Index(fields=['item_type', 'name']),
        ]
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({self.get_item_type_display()})"
    
    def save(self, *args, **kwargs):
        # Generate a unique slug if it doesn't exist
        if not self.slug:
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 1
            
            while LayoutItem.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            
            self.slug = slug
        
        # Validate parent-child relationship type
        if self.parent:
            valid_types = self.VALID_PARENT_CHILD_RELATIONSHIPS.get(self.parent.item_type, [])
            if self.item_type not in valid_types:
                raise ValueError(
                    f"Invalid hierarchical relationship: {self.parent.item_type} cannot contain {self.item_type}. "
                    f"Valid child types are: {', '.join(valid_types)}"
                )
        elif self.item_type not in self.VALID_PARENT_CHILD_RELATIONSHIPS.get(None, []):
            raise ValueError(f"{self.item_type} must have a parent")
        
        # Clear cache for this item's parent to refresh child lists
        if self.parent_id:
            cache_key = f'layout_children_{self.parent_id}'
            cache.delete(cache_key)
        
        # Call the original save method
        super().save(*args, **kwargs)
    
    def delete(self, *args, **kwargs):
        # Clear cache before deletion
        parent_id = self.parent_id
        cache_key = f'layout_item_{self.id}'
        children_key = f'layout_children_{self.id}'
        cache.delete(cache_key)
        cache.delete(children_key)
        
        # Delete the item
        result = super().delete(*args, **kwargs)
        
        # Clear parent's cache
        if parent_id:
            parent_cache_key = f'layout_children_{parent_id}'
            cache.delete(parent_cache_key)
            
        return result
    
    @classmethod
    def get_children(cls, parent_id=None):
        """Get children with caching for improved performance"""
        cache_key = f'layout_children_{parent_id}' if parent_id else 'layout_root_items'
        cached_items = cache.get(cache_key)
        
        if cached_items is None:
            if parent_id is None:
                items = list(cls.objects.filter(parent=None).values(
                    'id', 'name', 'item_type', 'x_position', 'y_position', 'slug'
                ))
            else:
                items = list(cls.objects.filter(parent_id=parent_id).values(
                    'id', 'name', 'item_type', 'x_position', 'y_position', 'slug'
                ))
            
            # Add child count for expandable items
            item_ids = [item['id'] for item in items]
            if item_ids:
                child_counts = dict(cls.objects.filter(parent_id__in=item_ids)
                                     .values('parent_id')
                                     .annotate(count=Count('id'))
                                     .values_list('parent_id', 'count'))
                
                for item in items:
                    item['has_children'] = child_counts.get(item['id'], 0) > 0
            
            # Cache for 5 minutes (adjustable)
            cache.set(cache_key, items, 300)
            return items
        
        return cached_items
    
    def get_ancestors(self):
        """Get all ancestors in order from root to parent"""
        ancestors = []
        current = self.parent
        
        while current:
            ancestors.insert(0, current)
            current = current.parent
            
        return ancestors
    
    def get_path(self):
        """Get the full hierarchical path as a string"""
        ancestors = self.get_ancestors()
        path_parts = [a.name for a in ancestors] + [self.name]
        return ' > '.join(path_parts)

# Additional detail models that can be linked to specific item types
class ComputerDetails(models.Model):
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    mac_address = models.CharField(max_length=17, blank=True, null=True)
    operating_system = models.CharField(max_length=100, blank=True)
    cpu = models.CharField(max_length=100, blank=True)
    ram = models.CharField(max_length=50, blank=True)
    storage = models.CharField(max_length=100, blank=True)
    
    def __str__(self):
        return f"Computer Details ({self.id})"

class ServerDetails(models.Model):
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    mac_address = models.CharField(max_length=17, blank=True, null=True)
    operating_system = models.CharField(max_length=100, blank=True)
    role = models.CharField(max_length=100, blank=True)
    cpu = models.CharField(max_length=100, blank=True)
    ram = models.CharField(max_length=50, blank=True)
    storage = models.CharField(max_length=100, blank=True)
    
    def __str__(self):
        return f"Server Details ({self.id})"

class NetworkDeviceDetails(models.Model):
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    mac_address = models.CharField(max_length=17, blank=True, null=True)
    ports = models.IntegerField(default=0)
    manageable = models.BooleanField(default=False)
    
    def __str__(self):
        return f"Network Device Details ({self.id})"