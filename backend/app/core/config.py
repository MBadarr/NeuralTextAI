from dataclasses import dataclass
from os import getenv
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


@dataclass(frozen=True)
class Settings:
    frontend_url: str = getenv("FRONTEND_URL", "")


settings = Settings()
