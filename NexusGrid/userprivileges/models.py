from django.db import models

class LabAssignmentSetting(models.Model):
    instructor_limit = models.PositiveIntegerField(default=5)
    assistant_limit = models.PositiveIntegerField(default=5)

    class Meta:
        verbose_name = 'Lab Limits'
        verbose_name_plural = 'Lab Limits'

    def __str__(self):
        return f"Instructors: {self.instructor_limit}, Assistants: {self.assistant_limit}"

    @classmethod
    def get_current_limits(cls):
        """Returns the current lab limits (singleton pattern)."""
        return cls.objects.get_or_create(pk=1)[0]