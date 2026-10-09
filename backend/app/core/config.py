from dataclasses import dataclass
from os import getenv
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

auth_origin = (
    urlsplit(getenv("NEON_AUTH_BASE_URL", ""))
    ._replace(path="", query="", fragment="")
    .geturl()
)


@dataclass(frozen=True)
class Settings:
    app_name: str = "NeuralText AI"
    version: str = "0.1.0"
    frontend_url: str = getenv("FRONTEND_URL", "http://localhost:3000")
    neon_auth_base_url: str = getenv("NEON_AUTH_BASE_URL", "").rstrip("/")
    neon_auth_jwks_url: str = getenv("NEON_AUTH_JWKS_URL", "")
    neon_auth_issuer: str = getenv("NEON_AUTH_ISSUER", auth_origin)
    neon_auth_audience: str = getenv("NEON_AUTH_AUDIENCE", auth_origin)
    database_url: str = getenv("DATABASE_URL", "")

    @property
    def cors_origins(self) -> list[str]:
        return list(
            dict.fromkeys(
                origin
                for origin in (
                    self.frontend_url.rstrip("/"),
                    "http://localhost:3000",
                    "http://127.0.0.1:3000",
                )
                if origin
            )
        )


settings = Settings()
