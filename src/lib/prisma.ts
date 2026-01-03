import { PrismaClient, Prisma, Role, AssistantRole, EventType, TaskPriority, TaskStatus } from '@prisma/client';
import type { User as PrismaUser } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export const isPrismaError = (error: unknown): error is Prisma.PrismaClientKnownRequestError => {
  return error instanceof Prisma.PrismaClientKnownRequestError;
};

export { Prisma, Role, AssistantRole, EventType, TaskPriority, TaskStatus };
export type { PrismaUser };
export default prisma;
