// SPDX-License-Identifier: MIT

import { PrismaClient as MongoPrismaClient } from '../generated/mongodb/index.js';
import { PrismaClient as PostgresPrismaClient } from '../generated/postgresql/index.js';

type DatabaseProvider = 'postgresql' | 'mongodb';

type CounterStore = {
  getCount(): Promise<number>;
  increment(): Promise<number>;
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

function createPostgresStore(client: PostgresPrismaClient): CounterStore {
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
    disconnect: () => client.$disconnect(),
  };
}

function createMongoStore(client: MongoPrismaClient): CounterStore {
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

export function disconnectDatabase(): Promise<void> {
  return store.disconnect();
}

export function getDatabaseProvider(): 'postgresql' | 'mongodb' {
  return provider;
}
