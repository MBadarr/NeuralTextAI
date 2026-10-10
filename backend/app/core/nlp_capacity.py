"""Keep expensive NLP requests within a single process's memory budget."""

from collections.abc import AsyncIterator
from threading import BoundedSemaphore

from fastapi import HTTPException, Request

_capacity = BoundedSemaphore(1)


async def limit_nlp_requests(request: Request) -> AsyncIterator[None]:
    # GET /models reads metadata without running inference.
    if request.method == "GET":
        yield
        return
    # Waiting requests would retain their bodies and can exhaust memory too.
    if not _capacity.acquire(blocking=False):
        raise HTTPException(
            503,
            "The analysis service is busy. Please retry in a moment.",
            headers={"Retry-After": "1", "X-Service-Error": "nlp_busy"},
        )
    try:
        yield
    finally:
        _capacity.release()
