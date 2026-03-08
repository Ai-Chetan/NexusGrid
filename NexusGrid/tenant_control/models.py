from django.db import models


class TenantStatus(models.TextChoices):
    PROVISIONING = "provisioning", "Provisioning"
    ACTIVE = "active", "Active"
    SUSPENDED = "suspended", "Suspended"
    DELETED = "deleted", "Deleted"
    FAILED = "failed", "Failed"


class SubscriptionStatus(models.TextChoices):
    TRIAL = "trial", "Trial"
    ACTIVE = "active", "Active"
    PAST_DUE = "past_due", "Past Due"
    CANCELED = "canceled", "Canceled"
    EXPIRED = "expired", "Expired"


class ProvisioningState(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    FAILED = "failed", "Failed"
    COMPLETED = "completed", "Completed"


class Tenant(models.Model):
    slug = models.SlugField(max_length=63, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20,
        choices=TenantStatus.choices,
        default=TenantStatus.PROVISIONING,
        db_index=True,
    )

    # DB metadata for the tenant runtime database.
    db_name = models.CharField(max_length=128, unique=True)
    db_host = models.CharField(max_length=255, default="127.0.0.1")
    db_port = models.PositiveIntegerField(default=5432)
    db_user = models.CharField(max_length=128)
    db_password_ciphertext = models.TextField(blank=True)

    schema_version = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["slug"]

    def __str__(self):
        return f"{self.slug} ({self.status})"


class TenantDomain(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="domains")
    domain = models.CharField(max_length=255, unique=True, db_index=True)
    is_primary = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["domain"]

    def __str__(self):
        return self.domain


class Package(models.Model):
    code = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.code


class Feature(models.Model):
    code = models.CharField(max_length=120, unique=True)
    module_key = models.CharField(max_length=80)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.code


class PackageFeature(models.Model):
    package = models.ForeignKey(Package, on_delete=models.CASCADE, related_name="package_features")
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE, related_name="feature_packages")
    enabled = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["package", "feature"], name="uniq_package_feature"),
        ]

    def __str__(self):
        return f"{self.package.code}:{self.feature.code}={self.enabled}"


class TenantSubscription(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="subscriptions")
    package = models.ForeignKey(Package, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.ACTIVE,
        db_index=True,
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-starts_at"]

    def __str__(self):
        return f"{self.tenant.slug}:{self.package.code} ({self.status})"


class TenantFeatureOverride(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="feature_overrides")
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE, related_name="tenant_overrides")
    enabled = models.BooleanField()
    reason = models.CharField(max_length=255, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "feature"], name="uniq_tenant_feature_override"),
        ]

    def __str__(self):
        return f"{self.tenant.slug}:{self.feature.code}={self.enabled}"


class ProvisioningJob(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="provisioning_jobs")
    state = models.CharField(
        max_length=20,
        choices=ProvisioningState.choices,
        default=ProvisioningState.PENDING,
        db_index=True,
    )
    step = models.CharField(max_length=120, blank=True)
    error_payload = models.JSONField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.tenant.slug}:{self.state}"


class AuditEvent(models.Model):
    tenant = models.ForeignKey(
        Tenant,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_events",
    )
    category = models.CharField(max_length=50, db_index=True)
    action = models.CharField(max_length=120, db_index=True)
    actor_user_id = models.IntegerField(null=True, blank=True)
    actor_username = models.CharField(max_length=150, blank=True)
    request_id = models.CharField(max_length=64, blank=True)
    source = models.CharField(max_length=50, default="system")
    object_type = models.CharField(max_length=80, blank=True)
    object_id = models.CharField(max_length=120, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant", "created_at"]),
            models.Index(fields=["category", "created_at"]),
            models.Index(fields=["action", "created_at"]),
        ]

    def __str__(self):
        return f"{self.category}:{self.action}"
