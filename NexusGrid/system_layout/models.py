from django.db import models

class Block(models.Model):
    x = models.IntegerField(default=0)
    y = models.IntegerField(default=0)

    def __str__(self):
        return f"Block {self.id} at ({self.x}, {self.y})"