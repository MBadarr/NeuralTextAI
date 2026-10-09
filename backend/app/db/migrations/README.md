# Database migrations

Numbered `.sql` files are applied transactionally at application startup.
`public.neuraltext_schema_migrations` tracks completed versions. A transaction
advisory lock serializes simultaneous starts. Add new numbered migrations;
do not edit a version already applied to a database.

The document table stores owner IDs and JSONB analysis payloads. Its generated
position preserves insertion order; updates keep their original position.
Row-level security denies direct access by non-owner database roles. The app
uses DATABASE_URL's owner role and scopes every repository operation by user.
