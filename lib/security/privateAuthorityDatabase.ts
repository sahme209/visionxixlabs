import { PrismaClient } from "@prisma/client";

/**
 * Creates one actual lazy Prisma client from an explicit PostgreSQL datasource.
 * The private owner must call $disconnect. No connection or SQL is initiated here.
 * Construction is configuration, not authorization or qualified resource custody.
 */
export function createPrivateAuthorityDatabase(datasource: string): PrismaClient {
  if (typeof datasource !== "string" || !datasource || datasource.length > 8192 || datasource.trim() !== datasource || /[\u0000-\u0020\u007f]/.test(datasource)) throw new Error("Explicit PostgreSQL datasource is required");
  let parsed: URL;
  try { parsed = new URL(datasource); } catch { throw new Error("Invalid PostgreSQL datasource"); }
  if (!["postgresql:", "postgres:"].includes(parsed.protocol) || !parsed.hostname || parsed.pathname.length <= 1 || parsed.hash) throw new Error("Invalid PostgreSQL datasource");
  return new PrismaClient({ datasources: { db: { url: datasource } } });
}
