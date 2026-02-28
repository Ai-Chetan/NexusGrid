# models.py
from django.db import models
from login_manager.models import User

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

    position_x = models.IntegerField(default=0)
    position_y = models.IntegerField(default=0)
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

    # ── Ancestor queries (PostgreSQL recursive CTE) ─────────────────────────
    #
    # Both methods issue a single SQL query regardless of tree depth, replacing
    # the old Python while-loop that fired one DB round-trip per ancestor level.
    #
    # The CTE walks upward through the self-referential parent FK:
    #   base case  : the starting node (parent of self, or self)
    #   recursive  : follow parent_id one level up per iteration
    #   termination: parent_id IS NULL  OR  depth reaches max_depth
    # Results are ordered depth DESC so the root always comes first.

    _ANCESTOR_CTE_SQL = """
        WITH RECURSIVE anc(id, name, item_type, parent_id, depth) AS (
            SELECT id, name, item_type, parent_id, 0
            FROM   system_layout_layoutitem
            WHERE  id = %s
            UNION ALL
            SELECT li.id, li.name, li.item_type, li.parent_id, anc.depth + 1
            FROM   system_layout_layoutitem li
            JOIN   anc ON li.id = anc.parent_id
            WHERE  anc.depth < %s
        )
        SELECT id, name, item_type, parent_id
        FROM   anc
        ORDER  BY depth DESC
    """

    def get_ancestors(self, max_depth: int = 20) -> list:
        """
        Return a list of ancestor LayoutItems ordered root-first.

        Fires exactly ONE SQL query (recursive CTE) regardless of tree depth.
        Returns an empty list immediately if this node has no parent,
        without touching the database.
        """
        if not self.parent_id:
            return []
        return list(
            LayoutItem.objects.raw(
                LayoutItem._ANCESTOR_CTE_SQL,
                [self.parent_id, max_depth - 1],
            )
        )

    @classmethod
    def get_breadcrumb(cls, pk: int, max_depth: int = 20) -> list:
        """
        Return the full breadcrumb path for the given pk — inclusive of the
        node itself — ordered root-first, e.g.:
            [Building, Floor, Room, Computer]

        Fires exactly ONE SQL query (recursive CTE).  Returns an empty list
        when pk does not exist (callers should treat this as a 404).
        """
        return list(
            cls.objects.raw(
                cls._ANCESTOR_CTE_SQL,
                [pk, max_depth],
            )
        )


class Lab(models.Model):
    layout_item = models.OneToOneField(LayoutItem, on_delete=models.CASCADE, limit_choices_to={'item_type': 'room'}, related_name='lab')
    lab_name = models.CharField(max_length=100)
    lab_code = models.CharField(max_length=20, unique=True, null=True, blank=True, db_index=True,
                                help_text="Short unique code used for QR identification, e.g. LAB-A101")
    location = models.CharField(max_length=100, null=True)
    instructors = models.ManyToManyField(User, blank=True, related_name='instructor_labs')
    assistants = models.ManyToManyField(User, blank=True, related_name='assistant_labs')
    capacity = models.IntegerField(null=True)
    dimension = models.CharField(max_length=50, null=True)
    quick_info = models.JSONField(blank=True, null=True, default=dict)

    def __str__(self):
        return self.lab_name

    @property
    def floor_item(self):
        """The parent LayoutItem (floor) — derived from layout_item.parent."""
        return self.layout_item.parent if self.layout_item_id else None

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
        return self.quick_info or {}

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
        db_index=True,
        null=True,
        blank=True
    )

    host_name = models.CharField(max_length=255, null=True, blank=True, default="")

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