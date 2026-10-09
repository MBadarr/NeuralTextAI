from datetime import UTC, datetime, timedelta
from pathlib import Path
from runpy import run_path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives.asymmetric import ed25519
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import require_user
from app.dependencies import get_document_repository
from app.main import app
from app.repositories.document_repository import DocumentRepository


class AuthenticationTests(TestCase):
    def test_signed_in_token_defaults_use_auth_origin_without_endpoint_path(self):
        with (
            patch.dict(
                "os.environ",
                {"NEON_AUTH_BASE_URL": "https://auth.example/neondb/auth"},
                clear=True,
            ),
            patch("dotenv.load_dotenv"),
        ):
            configured = run_path(
                str(Path(__file__).resolve().parents[2] / "app/core/config.py")
            )["settings"]
        self.assertEqual(configured.neon_auth_issuer, "https://auth.example")
        self.assertEqual(configured.neon_auth_audience, "https://auth.example")

    def setUp(self):
        self.key = ed25519.Ed25519PrivateKey.generate()
        self.claims = {
            "sub": "user-one",
            "role": "authenticated",
            "emailVerified": True,
            "iss": settings.neon_auth_issuer,
            "aud": settings.neon_auth_audience,
            "iat": datetime.now(UTC),
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        }

    def authenticate(self, claims=None, key=None):
        token = jwt.encode(claims or self.claims, key or self.key, algorithm="EdDSA")
        with patch("app.core.security.get_jwks_client") as client:
            client.return_value.get_signing_key_from_jwt.return_value = SimpleNamespace(
                key=self.key.public_key()
            )
            return require_user(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
            )

    def test_valid_token_identifies_user(self):
        self.assertEqual(self.authenticate(), "user-one")

    def test_small_provider_clock_difference_is_tolerated(self):
        claims = {**self.claims, "iat": datetime.now(UTC) + timedelta(seconds=3)}
        self.assertEqual(self.authenticate(claims), "user-one")

    def test_missing_credentials_are_rejected(self):
        with self.assertRaises(HTTPException) as caught:
            require_user(None)
        self.assertEqual(caught.exception.status_code, 401)

    def test_expiry_issuer_audience_signature_and_anonymous_tokens_are_rejected(self):
        invalid_claims = [
            {**self.claims, "exp": datetime.now(UTC) - timedelta(seconds=60)},
            {**self.claims, "iat": datetime.now(UTC) + timedelta(seconds=60)},
            {**self.claims, "iss": "https://untrusted.example"},
            {**self.claims, "aud": "another-app"},
            {**self.claims, "role": "anonymous"},
            {**self.claims, "sub": ""},
        ]
        for claims in invalid_claims:
            with (
                self.subTest(claims=claims),
                self.assertRaises(HTTPException) as caught,
            ):
                self.authenticate(claims)
            self.assertEqual(caught.exception.status_code, 401)
        with self.assertRaises(HTTPException):
            self.authenticate(key=ed25519.Ed25519PrivateKey.generate())

    def test_unverified_user_is_rejected(self):
        with self.assertRaises(HTTPException) as caught:
            self.authenticate({**self.claims, "emailVerified": False})
        self.assertEqual(caught.exception.status_code, 403)

    def test_backend_cannot_be_accessed_without_authentication(self):
        with TestClient(app) as client:
            for path in ("/documents", "/insights", "/models"):
                self.assertEqual(client.get(path).status_code, 401)
            self.assertEqual(
                client.post("/analysis", json={"text": "Test"}).status_code, 401
            )

    def test_document_routes_hide_other_users_and_legacy_documents(self):
        repository = DocumentRepository()
        repository.save({"id": "owned", "title": "Private"}, "owner")
        repository.save({"id": "legacy", "title": "Legacy"})
        app.dependency_overrides[get_document_repository] = lambda: repository
        app.dependency_overrides[require_user] = lambda: "other-user"
        self.addCleanup(app.dependency_overrides.pop, get_document_repository)
        self.addCleanup(app.dependency_overrides.pop, require_user)
        with TestClient(app) as client:
            self.assertEqual(client.get("/documents").json(), [])
            self.assertEqual(client.get("/documents/owned").status_code, 404)
            self.assertEqual(client.delete("/documents/owned").status_code, 404)
            self.assertEqual(client.get("/insights").json()["total_documents"], 0)
        self.assertIsNotNone(repository.get("owned", "owner"))
