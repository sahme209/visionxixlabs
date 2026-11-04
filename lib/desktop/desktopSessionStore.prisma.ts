import "server-only";
import { prisma } from "@/lib/db";
import { createPrivatePrismaDesktopSessionStore } from "./privateDesktopSessionStore.prisma";
export const prismaDesktopSessionStore = createPrivatePrismaDesktopSessionStore(prisma);
