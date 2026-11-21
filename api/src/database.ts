// SPDX-License-Identifier: MIT

import { PrismaClient as MongoPrismaClient } from '../generated/mongodb/index.js';
import { PrismaClient as PostgresPrismaClient } from '../generated/postgresql/index.js';

type DatabaseProvider = 'postgresql' | 'mongodb';

export type GitHubIdentity = {
  githubId: string;
  username: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  profileUrl: string;
};

export type ProtectedUser = GitHubIdentity & {
  id: string;
  createdAt: string;
  lastLoginAt: string;
};

type StoredProtectedUser = GitHubIdentity & {
  id: string;
  createdAt: Date;
  lastLoginAt: Date;
};

type DatabaseStore = {
  getCount(): Promise<number>;
  increment(): Promise<number>;
  upsertGitHubUser(identity: GitHubIdentity): Promise<ProtectedUser>;
  createUserSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  getUserForSession(tokenHash: string): Promise<ProtectedUser | null>;
  deleteUserSession(tokenHash: string): Promise<void>;
  disconnect(): Promise<void>;
};

const counterId = 'github-profile-clicks';
const configuredProvider = process.env.DATABASE_PROVIDER?.trim().toLowerCase();
const databaseUrl = process.env.DATABASE_URL?.trim();

function isDatabaseProvider(value: string | undefined): value is DatabaseProvider {
  return value === 'postgresql' || value === 'mongodb';
}

if (!isDatabaseProvider(configuredProvider)) {
  throw new Error('DATABASE_PROVIDER must be either "postgresql" or "mongodb".');
}
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be configured for the selected Prisma provider.');
}

const provider = configuredProvider;

function toProtectedUser(user: StoredProtectedUser): ProtectedUser {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt.toISOString(),
  };
}

function createPostgresStore(client: PostgresPrismaClient): DatabaseStore {
  return {
    async getCount() {
      const counter = await client.profileClickCounter.upsert({
        where: { id: counterId },
        create: { id: counterId, count: 0 },
        update: {},
      });
      return counter.count;
    },
    async increment() {
      const counter = await client.profileClickCounter.upsert({
        where: { id: counterId },
        create: { id: counterId, count: 1 },
        update: { count: { increment: 1 } },
      });
      return counter.count;
    },
    async upsertGitHubUser(identity) {
      const now = new Date();
      const user = await client.protectedUser.upsert({
        where: { githubId: identity.githubId },
        create: { ...identity, lastLoginAt: now },
        update: { ...identity, lastLoginAt: now },
      });
      return toProtectedUser(user);
    },
    async createUserSession(userId, tokenHash, expiresAt) {
      await client.protectedUserSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await client.protectedUserSession.create({ data: { userId, tokenHash, expiresAt } });
    },
    async getUserForSession(tokenHash) {
      const session = await client.protectedUserSession.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!session) return null;
      if (session.expiresAt <= new Date()) {
        await client.protectedUserSession.deleteMany({ where: { id: session.id } });
        return null;
      }
      return toProtectedUser(session.user);
    },
    async deleteUserSession(tokenHash) {
      await client.protectedUserSession.deleteMany({ where: { tokenHash } });
    },
    disconnect: () => client.$disconnect(),
  };
}

function createMongoStore(client: MongoPrismaClient): DatabaseStore {
  return {
    async getCount() {
      const counter = await client.profileClickCounter.upsert({
        where: { id: counterId },
        create: { id: counterId, count: 0 },
        update: {},
      });
      return counter.count;
    },
    async increment() {
      const counter = await client.profileClickCounter.upsert({
        where: { id: counterId },
        create: { id: counterId, count: 1 },
        update: { count: { increment: 1 } },
      });
      return counter.count;
    },
    async upsertGitHubUser(identity) {
      const now = new Date();
      const user = await client.protectedUser.upsert({
        where: { githubId: identity.githubId },
        create: { ...identity, lastLoginAt: now },
        update: { ...identity, lastLoginAt: now },
      });
      return toProtectedUser(user);
    },
    async createUserSession(userId, tokenHash, expiresAt) {
      await client.protectedUserSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await client.protectedUserSession.create({ data: { userId, tokenHash, expiresAt } });
    },
    async getUserForSession(tokenHash) {
      const session = await client.protectedUserSession.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!session) return null;
      if (session.expiresAt <= new Date()) {
        await client.protectedUserSession.deleteMany({ where: { id: session.id } });
        return null;
      }
      return toProtectedUser(session.user);
    },
    async deleteUserSession(tokenHash) {
      await client.protectedUserSession.deleteMany({ where: { tokenHash } });
    },
    disconnect: () => client.$disconnect(),
  };
}

const store = provider === 'postgresql'
  ? createPostgresStore(new PostgresPrismaClient())
  : createMongoStore(new MongoPrismaClient());

export function getProfileClickCount(): Promise<number> {
  return store.getCount();
}

export function recordProfileClick(): Promise<number> {
  return store.increment();
}

export function upsertGitHubUser(identity: GitHubIdentity): Promise<ProtectedUser> {
  return store.upsertGitHubUser(identity);
}

export function createProtectedUserSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
  return store.createUserSession(userId, tokenHash, expiresAt);
}

export function getProtectedUserForSession(tokenHash: string): Promise<ProtectedUser | null> {
  return store.getUserForSession(tokenHash);
}

export function deleteProtectedUserSession(tokenHash: string): Promise<void> {
  return store.deleteUserSession(tokenHash);
}

export function disconnectDatabase(): Promise<void> {
  return store.disconnect();
}

export function getDatabaseProvider(): 'postgresql' | 'mongodb' {
  return provider;
}
