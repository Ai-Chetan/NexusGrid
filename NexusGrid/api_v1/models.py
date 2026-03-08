from django.db import models
from django.conf import settings


class Notification(models.Model):
	RELATED_TYPE_CHOICES = [
		('fault_report', 'Fault Report'),
		('fault_status_update', 'Fault Report Status Update'),
		('resource_request', 'Resource Request'),
		('resource_status_update', 'Resource Request Status Update'),
		('admin_message', 'Admin Message'),
		('system_alert', 'System Alert'),
	]

	created_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name='created_notifications',
	)
	recipient = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='notifications',
	)
	message = models.TextField()
	related_to = models.CharField(max_length=40, choices=RELATED_TYPE_CHOICES)
	related_id = models.PositiveIntegerField(null=True, blank=True)
	target_url = models.CharField(max_length=255, blank=True, default='')
	is_read = models.BooleanField(default=False)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['recipient', 'is_read']),
			models.Index(fields=['related_to', 'related_id']),
			models.Index(fields=['created_at']),
		]

	def __str__(self):
		return f"Notification<{self.id}> to {self.recipient_id}: {self.related_to}"
