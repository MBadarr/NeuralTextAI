"""Opt-in PostgreSQL checks; test records are uniquely named and cleaned up."""

from datetime import UTC, datetime
from os import getenv
from unittest import TestCase, skipUnless
from uuid import uuid4

from psycopg_pool import ConnectionPool

from app.repositories.document_repository import DocumentRepository


@skipUnless(getenv("TEST_DATABASE_URL"), "Set TEST_DATABASE_URL for PostgreSQL checks")
class PostgresRepositoryTests(TestCase):
    def setUp(self):
        self.owner = f"test-{uuid4()}"
        self.ids = [f"test-{uuid4()}" for _ in range(3)]
        self.pool = self.make_pool()
        self.repository = DocumentRepository(self.pool)
        self.repository.initialize()
        self.addCleanup(self.pool.close)
        self.addCleanup(self.clean_records)

    @staticmethod
    def make_pool():
        return ConnectionPool(
            getenv("TEST_DATABASE_URL"),
            open=False,
            min_size=1,
            max_size=2,
            kwargs={
                "connect_timeout": 10,
                "sslmode": "require",
                "prepare_threshold": None,
            },
        )

    def clean_records(self):
        with self.pool.connection() as connection:
            connection.execute(
                "DELETE FROM public.documents WHERE id = ANY(%s)", (self.ids,)
            )

    def test_json_dates_order_updates_and_persistence_across_connections(self):
        created = datetime.now(UTC)
        first, second, _ = self.ids
        payload = {
            "id": first,
            "created_at": created,
            "text": "Unicode: café 🌙",
            "entities": [{"text": "London", "label": "GPE"}],
            "tokens": [{"text": "running", "lemma": "run", "stem": "run"}],
            "intent": {"label": "Request", "scores": {"Request": 1}},
            "emotions": {"label": "Joy", "scores": {"Joy": 1.5}},
        }
        self.repository.save(payload, self.owner)
        self.repository.save({"id": second}, self.owner)
        with self.make_pool() as other_pool:
            other = DocumentRepository(other_pool)
            self.assertEqual(other.get(first, self.owner), payload)
            self.assertEqual(
                [item["id"] for item in other.list(self.owner)], [second, first]
            )
            other.save({**payload, "title": "Updated"}, self.owner)
            self.assertEqual(self.repository.get(first, self.owner)["title"], "Updated")
            self.assertTrue(other.delete(second, self.owner))
            self.assertIsNone(self.repository.get(second, self.owner))

    def test_owner_checks_and_failed_overwrite_rollback(self):
        first, second, legacy = self.ids
        self.repository.save({"id": first}, self.owner)
        self.repository.save({"id": second}, self.owner + "-other")
        self.repository.save({"id": legacy})
        with self.assertRaises(ValueError):
            self.repository.save({"id": first, "changed": True}, self.owner + "-other")
        self.assertIsNone(self.repository.get(first, self.owner + "-other"))
        self.assertFalse(self.repository.delete(first, self.owner + "-other"))
        self.assertEqual(self.repository.list(self.owner), [{"id": first}])
        self.assertEqual(self.repository.get(first, self.owner), {"id": first})
        self.assertIsNone(self.repository.get(legacy, self.owner))
        self.assertEqual(self.repository.get(legacy), {"id": legacy})
