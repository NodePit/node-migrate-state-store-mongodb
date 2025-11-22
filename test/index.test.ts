import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { MongoMigrationOptions, MongoStateStore, synchronizedMigration, synchronizedUp } from '../lib/index';
import { MongoClient } from 'mongodb';
import { promisify } from 'util';
import path from 'path';

const migrationDoc = {
  migrations: [
    {
      title: '1587915479438-my-migration.js',
      description: null,
      timestamp: 1587919095301.0
    }
  ],
  lastRun: '1587915479438-my-migration.js'
};

const mongoUrl = process.env.MONGO_URL as string;

describe('migrate MongoDB state store', () => {
  const defaultCollectionName = 'migrations';

  let client: MongoClient;

  beforeAll(async () => {
    client = await MongoClient.connect(mongoUrl);
  });

  beforeEach(async () => {
    await cleanAllCollections(client);
  });

  afterAll(async () => {
    await client.close();
  });

  describe('initialization', () => {
    it('can be instantiated', () => {
      const stateStore = new MongoStateStore('foo');
      expect(stateStore).toBeInstanceOf(Object);
    });

    it('can be instantiated with options object', () => {
      const stateStore = new MongoStateStore({
        uri: 'foo',
        collectionName: 'custom_migrations'
      });
      expect(stateStore).toBeInstanceOf(Object);
    });
  });

  describe('errors', () => {
    it('throws error when connection fails', async () => {
      const stateStore = new MongoStateStore('invalid_url');
      await expect(() => promisify<void>(callback => stateStore.load(callback))()).rejects.toThrowError();
    });
  });

  describe('loading state', () => {
    it('throws error when migrations collection contains more than one document', async () => {
      await client
        .db()
        .collection(defaultCollectionName)
        .insertOne({ ...migrationDoc });
      await client
        .db()
        .collection(defaultCollectionName)
        .insertOne({ ...migrationDoc });
      const stateStore = new MongoStateStore(mongoUrl);
      await expect(() => promisify<void>(callback => stateStore.load(callback))()).rejects.toThrow(
        'Expected exactly one result, but got 2'
      );
    });

    it('returns empty object when migration collection is empty', async () => {
      const stateStore = new MongoStateStore(mongoUrl);
      const result = await promisify<any>(callback => stateStore.load(callback))();
      expect(result).toEqual({});
    });

    it('returns migrations document', async () => {
      await client
        .db()
        .collection(defaultCollectionName)
        .insertOne({ ...migrationDoc });
      const stateStore = new MongoStateStore(mongoUrl);
      const result = await promisify<any>(callback => stateStore.load(callback))();
      expect(result).toMatchObject(migrationDoc);
    });

    it('returns migrations document from custom collection', async () => {
      const customCollectionName = '__custom_migrations';
      const customMigrationDoc = { ...migrationDoc, lastRun: `${new Date().getTime()}-my-migration.js` };
      await client
        .db()
        .collection(customCollectionName)
        .insertOne({ ...customMigrationDoc });
      const stateStore = new MongoStateStore({
        uri: mongoUrl,
        collectionName: customCollectionName
      });
      const result = await promisify<any>(callback => stateStore.load(callback))();
      expect(result).toMatchObject(customMigrationDoc);
    });
  });

  describe('saving state', () => {
    it('inserts new document into empty migrations collection', async () => {
      const stateStore = new MongoStateStore(mongoUrl);
      await promisify<void>(callback => stateStore.save(migrationDoc, callback))();
      const docs = await client.db().collection(defaultCollectionName).find({}).toArray();
      expect(docs).toHaveLength(1);
      expect(docs[0]).toMatchObject(migrationDoc);
    });

    it('inserts new document into empty custom migrations collection', async () => {
      const customCollectionName = '__custom_migrations';
      const stateStore = new MongoStateStore({
        uri: mongoUrl,
        collectionName: customCollectionName
      });
      await promisify<void>(callback => stateStore.save(migrationDoc, callback))();
      const docs = await client.db().collection(customCollectionName).find({}).toArray();
      expect(docs).toHaveLength(1);
      expect(docs[0]).toMatchObject(migrationDoc);
    });

    it('replaces existing document in migrations collection', async () => {
      await client.db().collection(defaultCollectionName).insertOne({});
      const stateStore = new MongoStateStore(mongoUrl);
      await promisify<void>(callback => stateStore.save(migrationDoc, callback))();
      const docs = await client.db().collection(defaultCollectionName).find({}).toArray();
      expect(docs).toHaveLength(1);
      expect(docs[0]).toMatchObject(migrationDoc);
    });
  });
});

describe('migrate MongoDB state store with locking', () => {
  const collectionName = 'migrations';
  const lockCollectionName = 'migrationlock';
  const testCollectionName = 'test';

  let client: MongoClient;

  beforeAll(async () => {
    client = await MongoClient.connect(mongoUrl);
  });

  beforeEach(async () => {
    await cleanAllCollections(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it('creates lock entry in database upon load', async () => {
    const migrationOptions: MongoMigrationOptions = {
      stateStore: new MongoStateStore({
        uri: mongoUrl,
        collectionName: collectionName,
        lockCollectionName: lockCollectionName
      }),
      migrationsDirectory: path.join(__dirname, './migrations')
    };
    let numDocsInLockCollection: number | undefined;
    await synchronizedMigration(migrationOptions, async () => {
      // lockCollection should have exactly one entry
      numDocsInLockCollection = await client.db().collection(lockCollectionName).countDocuments();
    });
    expect(numDocsInLockCollection).toEqual(1);
  });

  it('deletes lock entry in database upon save', async () => {
    const migrationOptions: MongoMigrationOptions = {
      stateStore: new MongoStateStore({
        uri: mongoUrl,
        collectionName: collectionName,
        lockCollectionName: lockCollectionName
      }),
      migrationsDirectory: path.join(__dirname, './migrations')
    };
    await synchronizedMigration(migrationOptions, async () => {
      // nothing to do
    });
    // lockCollection should have no entry
    const numDocsInLockCollection = await client.db().collection(lockCollectionName).countDocuments();
    expect(numDocsInLockCollection).toEqual(0);
  });

  it('properly releases lock when running sequentially', async () => {
    const migrationOptions: MongoMigrationOptions = {
      stateStore: new MongoStateStore({
        uri: mongoUrl,
        collectionName: collectionName,
        lockCollectionName: lockCollectionName
      }),
      migrationsDirectory: path.join(__dirname, './migrations')
    };

    for (let i = 0; i < 10; i++) {
      await synchronizedUp(migrationOptions);
    }

    const docsInTestCollection = await client.db().collection(testCollectionName).find({}).toArray();
    expect(docsInTestCollection).toHaveLength(1);
  });

  it('properly releases lock when running in parallel', async () => {
    const migrationOptions: MongoMigrationOptions = {
      stateStore: new MongoStateStore({
        uri: mongoUrl,
        collectionName: collectionName,
        lockCollectionName: lockCollectionName
      }),
      migrationsDirectory: path.join(__dirname, './migrations')
    };

    const promises: Promise<void>[] = [];

    // simulate ten nodes
    for (let i = 0; i < 10; i++) {
      promises.push(synchronizedUp(migrationOptions));
    }

    await Promise.all(promises);

    const docsInTestCollection = await client.db().collection(testCollectionName).find({}).toArray();
    expect(docsInTestCollection).toHaveLength(1);
  });
});

describe('parameter validation', () => {
  it('throws if migration opts has no stateStore', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await expect(() => synchronizedMigration({} as any, () => Promise.resolve())).rejects.toThrow(
      'No `stateStore` in migration options'
    );
  });
  it('throws if stateStore is not a MongoStateStore', async () => {
    await expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      synchronizedMigration({ stateStore: 'migrations' } as any, () => Promise.resolve())
    ).rejects.toThrow('Given `stateStore` is not `MongoStateStore`');
  });
  it('throws if lockCollectionName is not set', async () => {
    await expect(() =>
      synchronizedMigration({ stateStore: new MongoStateStore(mongoUrl) }, () => Promise.resolve())
    ).rejects.toThrow('`lockCollectionName` in MongoStateStore is not set');
  });
});

async function cleanAllCollections(client: MongoClient): Promise<void> {
  const collections = await client.db().collections();
  const cleanupPromises = Object.values(collections).map(async collection => {
    try {
      await collection.deleteMany({});
    } catch {
      // Ignore errors - collection might not exist
    }
  });
  await Promise.all(cleanupPromises);
}
