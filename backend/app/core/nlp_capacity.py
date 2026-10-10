"""Keep expensive NLP requests within a single process's memory budget."""

from collections.abc import AsyncIterator
from threading import BoundedSemaphore

from fastapi import HTTPException

_capacity = BoundedSemaphore(1)


async def limit_nlp_requests() -> AsyncIterator[None]:
    # Waiting requests would retain their bodies and can exhaust memory too.
    if not _capacity.acquire(blocking=False):
        raise HTTPException(
            503,
            "The analysis service is busy. Please retry in a moment.",
            headers={"Retry-After": "1"},
        )
    try:
        yield
    finally:
        _capacity.release()
