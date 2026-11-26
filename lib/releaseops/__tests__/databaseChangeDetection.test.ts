import { describe, expect, it } from "vitest";
import { migrationPaths } from "../databaseChangeDetection";

describe("migrationPaths", () => {
  it("finds common migration layouts and ignores ordinary code", () => {
    expect(migrationPaths([
      "prisma/migrations/20261126_add/migration.sql", "app/page.tsx", "db/migrate/20261126_add_users.rb",
      "alembic/versions/abc_add.py", "src/main/resources/db/migration/V12__add_index.sql", "services/api/migrations/0004_add.sql",
      "docs/migrations.md", "supabase/migrations/2026_add.sql", "drizzle/0001_init.sql",
    ])).toEqual(["alembic/versions/abc_add.py", "db/migrate/20261126_add_users.rb", "drizzle/0001_init.sql", "prisma/migrations/20261126_add/migration.sql", "services/api/migrations/0004_add.sql", "src/main/resources/db/migration/V12__add_index.sql", "supabase/migrations/2026_add.sql"]);
  });
});
