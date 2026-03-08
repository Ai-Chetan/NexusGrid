from django.test import TestCase
from rest_framework.test import APIClient


class HealthEndpointTests(TestCase):
	def setUp(self):
		self.client = APIClient()

	def test_control_health_endpoint(self):
		response = self.client.get("/api/v1/health/control/")
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["status"], "ok")

	def test_tenant_health_endpoint_without_tenant_context(self):
		response = self.client.get("/api/v1/health/tenant/")
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["status"], "ok")
