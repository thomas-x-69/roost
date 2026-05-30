"""
Database initialization + lightweight migration runner.

New installs get the full schema from SQLAlchemy's create_all. Existing
databases are upgraded incrementally using SQLite's PRAGMA user_version as a
schema-version stamp: each entry in MIGRATIONS is a (version, [sql, ...]) pair
applied in order when the stored version is lower.

create_all is additive — it creates missing tables but never ALTERs existing
ones. So when you change a column on an existing table, add a migration here
(e.g. an `ALTER TABLE ... ADD COLUMN`) and bump SCHEMA_VERSION.
"""
import asyncio
import logging

from backend.database.engine import engine
from backend.database.base import Base
import backend.database.models  # noqa: F401  (import all models for metadata)

logger = logging.getLogger("roost.migrations")

# Current target schema version. Bump when you add a migration below.
SCHEMA_VERSION = 1

# Incremental upgrades for pre-existing databases. Example:
#   (2, ["ALTER TABLE devices ADD COLUMN room TEXT"]),
MIGRATIONS: list[tuple[int, list[str]]] = []


async def init_db():
    async with engine.begin() as conn:
        had_tables = (
            await conn.exec_driver_sql(
                "SELECT count(*) FROM sqlite_master "
                "WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
        ).scalar()

        # Create any missing tables (whole schema on a fresh DB).
        await conn.run_sync(Base.metadata.create_all)

        version = (await conn.exec_driver_sql("PRAGMA user_version")).scalar() or 0

        if not had_tables:
            # Brand-new database — create_all already built the latest schema.
            version = SCHEMA_VERSION
        else:
            for target, statements in MIGRATIONS:
                if target > version:
                    logger.info(f"Applying DB migration -> v{target}")
                    for stmt in statements:
                        await conn.exec_driver_sql(stmt)
                    version = target
            version = max(version, 1)

        # PRAGMA can't be parameter-bound; version is a trusted int.
        await conn.exec_driver_sql(f"PRAGMA user_version = {int(version)}")
        logger.info(f"Database schema at version {version}")


if __name__ == "__main__":
    asyncio.run(init_db())
