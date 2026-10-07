from unittest import TestCase

from fastapi.testclient import TestClient

from app.main import app


class MainRoutesTests(TestCase):
    def test_root_and_health(self):
        with TestClient(app) as client:
            self.assertEqual(client.get("/").status_code, 200)
            self.assertEqual(client.get("/health").status_code, 200)
