import { defineConfig } from "prisma/config";

// Generation/validation do not require a database. Missing configuration remains
// missing: no implicit localhost, preview target or synthetic URL is substituted.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL },
});
