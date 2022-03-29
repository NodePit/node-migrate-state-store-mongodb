import { MongoStateStore } from '../lib/index';
import { MongoClient } from 'mongodb';
import { promisify } from 'util';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      __MONGO_URI__: string;
      __MONGO_DB_NAME__: string;
    }
  }
}

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

const mongoUrl = `${global.__MONGO_URI__}${global.__MONGO_DB_NAME__}`;

describe('migrate MongoDB state store', () => {
  const defaultCollectionName = 'migrations';

  let client: MongoClient;

  beforeAll(async () => {
    client = await MongoClient.connect(mongoUrl);
  });

  beforeEach(async () => {
    await client.db().collection(defaultCollectionName).deleteMany({});
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
    it('throws error when connection fails', done => {
      const stateStore = new MongoStateStore('invalid_url');
      stateStore.load(err => {
        expect(err).toBeInstanceOf(Error);
        done();
      });
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
      try {
        await promisify<any>(callback => stateStore.load(callback))();
        expect(false).toEqual(true);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toEqual('Expected exactly one result, but got 2');
      }
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

  let client: MongoClient;

  beforeAll(async () => {
    client = await MongoClient.connect(mongoUrl);
  });

  beforeEach(async () => {
    await client.db().collection(collectionName).deleteMany({});
    await client.db().collection(lockCollectionName).deleteMany({});
  });

  afterAll(async () => {
    await client.close();
  });

  it('creates lock entry in database upon load', async () => {
    const stateStore = new MongoStateStore({
      uri: mongoUrl,
      collectionName: collectionName,
      lockCollectionName: lockCollectionName
    });
    await promisify(callback => stateStore.load(callback))();
    // lockCollection should have exactly one entry
    const numDocsInLockCollection = await client.db().collection(lockCollectionName).countDocuments();
    expect(numDocsInLockCollection).toEqual(1);
  });

  it('deletes lock entry in database upon save', async () => {
    const stateStore = new MongoStateStore({
      uri: mongoUrl,
      collectionName: collectionName,
      lockCollectionName: lockCollectionName
    });
    await client.db().collection(lockCollectionName).insertOne({ lock: 'lock' });
    await promisify<void>(callback => stateStore.save(migrationDoc, callback))();
    // lockCollection should have no entry
    const numDocsInLockCollection = await client.db().collection(lockCollectionName).countDocuments();
    expect(numDocsInLockCollection).toEqual(0);
  });

  it('prevents executing two migrations at once', async () => {
    const stateStore = new MongoStateStore({
      uri: mongoUrl,
      collectionName: collectionName,
      lockCollectionName: lockCollectionName
    });
    let executing = 0;
    const promises: Promise<void>[] = [];
    // simulate ten nodes
    for (let i = 0; i < 10; i++) {
      promises.push(
        (async () => {
          await promisify(callback => stateStore.load(callback))();
          executing++;
          expect(executing).toEqual(1);
          await promisify(setTimeout)(100);
          await promisify<void>(callback => stateStore.save(migrationDoc, callback))();
          executing--;
        })()
      );
    }
    await Promise.all(promises);
  });
});
