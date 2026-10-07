from dataclasses import dataclass
from os import getenv
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


@dataclass(frozen=True)
class Settings:
    app_name: str = "NeuralText AI"
    version: str = "0.1.0"
    frontend_url: str = getenv("FRONTEND_URL", "http://localhost:3000")
    document_database: Path = Path(
        getenv(
            "DOCUMENT_DATABASE",
            str(Path(__file__).resolve().parents[2] / "data" / "neuraltext.sqlite3"),
        )
    )

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
