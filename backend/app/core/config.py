from dataclasses import dataclass
from os import getenv


@dataclass(frozen=True)
class Settings:
    app_name: str = "NeuralText AI"
    version: str = "0.1.0"
    cors_origins: tuple[str, ...] = (getenv("FRONTEND_URL", "http://localhost:3000"),)


settings = Settings()
