"""Database boundary reserved for persistent storage.

The current MVP intentionally uses an in-memory document store. Keeping this
module as the database boundary makes adding SQLite or PostgreSQL later
localized and avoids coupling routers to a database implementation.
"""


def get_database():
    return None
