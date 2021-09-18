import { MongoStateStore } from '../lib/index';
import { MongoClient } from 'mongodb';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      __MONGO_URI__: string;
      __MONGO_DB_NAME__: string;
    }
  }
}

describe('migrate MongoDB state store', () => {
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

  const defaultCollectionName = 'migrations';
  const mongoUrl = `${global.__MONGO_URI__}${global.__MONGO_DB_NAME__}`;

  let client: MongoClient;

  beforeAll(async () => {
    client = await MongoClient.connect(mongoUrl, { useNewUrlParser: true });
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
      await new Promise<void>(resolve => {
        stateStore.load((err, result) => {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toEqual('Expected exactly one result, but got 2');
          expect(result).toBeUndefined();
          resolve();
        });
      });
    });

    it('returns empty object when migration collection is empty', done => {
      const stateStore = new MongoStateStore(mongoUrl);
      stateStore.load((err, result) => {
        expect(err).toBeUndefined();
        expect(result).toEqual({});
        done();
      });
    });

    it('returns migrations document', async () => {
      await client
        .db()
        .collection(defaultCollectionName)
        .insertOne({ ...migrationDoc });
      const stateStore = new MongoStateStore(mongoUrl);
      return new Promise<void>(resolve => {
        stateStore.load((err, result) => {
          expect(err).toBeUndefined();
          expect(result).toMatchObject(migrationDoc);
          resolve();
        });
      });
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
      return new Promise<void>(resolve => {
        stateStore.load((err, result) => {
          expect(err).toBeUndefined();
          expect(result).toMatchObject(customMigrationDoc);
          resolve();
        });
      });
    });
  });

  describe('saving state', () => {
    it('inserts new document into empty migrations collection', async () => {
      const stateStore = new MongoStateStore(mongoUrl);
      await new Promise<void>((resolve, reject) =>
        stateStore.save(migrationDoc, err => (err ? reject(err) : resolve()))
      );
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
      await new Promise<void>((resolve, reject) =>
        stateStore.save(migrationDoc, err => (err ? reject(err) : resolve()))
      );
      const docs = await client.db().collection(customCollectionName).find({}).toArray();
      expect(docs).toHaveLength(1);
      expect(docs[0]).toMatchObject(migrationDoc);
    });

    it('replaces existing document in migrations collection', async () => {
      await client.db().collection(defaultCollectionName).insertOne({});
      const stateStore = new MongoStateStore(mongoUrl);
      await new Promise<void>((resolve, reject) =>
        stateStore.save(migrationDoc, err => (err ? reject(err) : resolve()))
      );
      const docs = await client.db().collection(defaultCollectionName).find({}).toArray();
      expect(docs).toHaveLength(1);
      expect(docs[0]).toMatchObject(migrationDoc);
    });
  });
});
