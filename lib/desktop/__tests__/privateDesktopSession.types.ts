import type { PrismaClient } from "@/lib/prismaClient";
import { createPrivatePrismaDesktopSessionStore } from "../privateDesktopSessionStore.prisma";
import { createPrivateRequestDesktopSessionResolver } from "../privateRequestDesktopSessionResolver";
// Compile-only: real generated Prisma delegate assignment, no client construction/connection.
export function composeSessionStore(repo: PrismaClient) {
 return createPrivatePrismaDesktopSessionStore(repo);
}
export function composeMembershipReader(repo: PrismaClient, dependencies: Omit<Parameters<typeof createPrivateRequestDesktopSessionResolver>[0], "repo">) {
 return createPrivateRequestDesktopSessionResolver({ ...dependencies, repo });
}
