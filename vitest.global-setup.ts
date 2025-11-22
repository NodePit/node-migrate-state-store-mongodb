import { MongoMemoryServer } from 'mongodb-memory-server-global';
import type { TestProject } from 'vitest/node';

// @ts-ignore
declare module 'vitest' {
  export interface ProvidedContext {
    MONGO_BASE_URI: string;
  }
}

let mongod: MongoMemoryServer;

export async function setup(project: TestProject) {
  mongod = await MongoMemoryServer.create({
    instance: {
      dbName: 'db',
      // https://github.com/nodkz/mongodb-memory-server/issues/78
      // storageEngine: 'wiredTiger'
      storageEngine: 'ephemeralForTest'
    }
  });
  // @ts-ignore
  project.provide('MONGO_BASE_URI', mongod.getUri());
}

export async function teardown() {
  if (mongod) {
    await mongod.stop();
    console.log('MongoDB Memory Server stopped');
  }
}
