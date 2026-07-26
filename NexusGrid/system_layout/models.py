# models.py
from django.db import models
from login_manager.models import User

# Layout item types that map to a physical System (vs building/floor/room containers).
SYSTEM_TYPES = ('computer', 'server', 'network_switch', 'router', 'printer', 'ups', 'rack')

# Allowed child item_types for each parent context. None key = root level.
# Single source of truth for hierarchy validation (mirrors frontend CHILD_TYPES).
ALLOWED_CHILDREN = {
    None:       ('building',),
    'building': ('floor',),
    'floor':    ('room',),
    'room':     SYSTEM_TYPES,
}


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

class PrivilegesConfig(models.Model):
    """Singleton row that stores admin-configurable limits for lab assignments."""
    max_labs_per_incharge = models.PositiveIntegerField(
        default=5,
        help_text="Maximum number of labs a single Lab Incharge can be concurrently assigned to.",
    )
    max_labs_per_assistant = models.PositiveIntegerField(
        default=3,
        help_text="Maximum number of labs a single Lab Assistant can be concurrently assigned to.",
    )
    max_incharges_per_lab = models.PositiveIntegerField(
        default=1,
        help_text="Maximum number of concurrently active Lab Incharges per lab.",
    )
    max_assistants_per_lab = models.PositiveIntegerField(
        default=1,
        help_text="Maximum number of concurrently active Lab Assistants per lab.",
    )

    class Meta:
        verbose_name = "Privileges Configuration"

    def __str__(self):
        return f"PrivilegesConfig (max incharge={self.max_labs_per_incharge}, max assistant={self.max_labs_per_assistant})"

    @classmethod
    def get_config(cls):
        obj, _ = cls.objects.get_or_create(pk=1, defaults={
            'max_labs_per_incharge': 5,
            'max_labs_per_assistant': 3,
        })
        return obj


class LabAssignment(models.Model):
    """
    Records the assignment of a Lab Incharge or Lab Assistant to a specific Lab,
    optionally within a date range (time-slot based).

    Constraints enforced programmatically:
    - At most one active incharge per lab at any time.
    - At most one active assistant per lab at any time.
    - A user's concurrent active assignments may not exceed the PrivilegesConfig limit.
    """
    ROLE_INCHARGE = 'incharge'
    ROLE_ASSISTANT = 'assistant'
    ROLE_CHOICES = [
        (ROLE_INCHARGE, 'Lab Incharge'),
        (ROLE_ASSISTANT, 'Lab Assistant'),
    ]

    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name='assignments')
    user = models.ForeignKey(
        'login_manager.User',
        on_delete=models.CASCADE,
        related_name='lab_assignments',
    )
    role_type = models.CharField(max_length=20, choices=ROLE_CHOICES)
    assigned_by = models.ForeignKey(
        'login_manager.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_assignments',
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    start_date = models.DateField(null=True, blank=True, help_text="Leave blank to start immediately.")
    end_date = models.DateField(null=True, blank=True, help_text="Leave blank for an indefinite assignment.")

    class Meta:
        ordering = ['-assigned_at']

    def __str__(self):
        return f"{self.user} → {self.lab} ({self.role_type})"

    @property
    def is_active(self):
        from django.utils import timezone
        today = timezone.now().date()
        if self.start_date and self.start_date > today:
            return False
        if self.end_date and self.end_date < today:
            return False
        return True

    @classmethod
    def active_qs(cls):
        """QuerySet base filter for currently active assignments (date-wise)."""
        from django.utils import timezone
        from django.db.models import Q
        today = timezone.now().date()
        return cls.objects.filter(
            Q(start_date__isnull=True) | Q(start_date__lte=today),
            Q(end_date__isnull=True) | Q(end_date__gte=today),
        )

    @classmethod
    def get_active_for_lab(cls, lab_id, role_type):
        """Return the currently active assignment for a specific lab + role, or None."""
        return cls.active_qs().filter(lab_id=lab_id, role_type=role_type).select_related('user').first()

    @classmethod
    def get_active_labs_for_user(cls, user):
        """Return all currently active assignments for a specific user."""
        return cls.active_qs().filter(user=user).select_related('lab', 'lab__layout_item')


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
        default='inactive',
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