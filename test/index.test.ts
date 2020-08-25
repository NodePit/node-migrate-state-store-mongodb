import { MongoStateStore } from '../lib/index';
import { MongoClient } from 'mongodb';

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
  const mongoUrl = process.env.MONGO_URL as string;

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
    it('throws error when migrations collection contains more than one document', async done => {
      await client
        .db()
        .collection(defaultCollectionName)
        .insertOne({ ...migrationDoc });
      await client
        .db()
        .collection(defaultCollectionName)
        .insertOne({ ...migrationDoc });
      const stateStore = new MongoStateStore(mongoUrl);
      stateStore.load((err, result) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toEqual('Expected exactly one result, but got 2');
        expect(result).toBeUndefined();
        done();
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

    it('returns migrations document', async done => {
      await client
        .db()
        .collection(defaultCollectionName)
        .insertOne({ ...migrationDoc });
      const stateStore = new MongoStateStore(mongoUrl);
      stateStore.load((err, result) => {
        expect(err).toBeUndefined();
        expect(result).toMatchObject(migrationDoc);
        done();
      });
    });
  });

  describe('saving state', () => {
    it('inserts new document into empty migrations collection', done => {
      const stateStore = new MongoStateStore(mongoUrl);
      stateStore.save(migrationDoc, err => {
        expect(err).toBeUndefined();
        void (async (): Promise<void> => {
          const docs = await client.db().collection(defaultCollectionName).find({}).toArray();
          expect(docs).toHaveLength(1);
          expect(docs[0]).toMatchObject(migrationDoc);
          done();
        })();
      });
    });

    it('replaces existing document in migrations collection', async done => {
      await client.db().collection(defaultCollectionName).insertOne({});
      const stateStore = new MongoStateStore(mongoUrl);
      stateStore.save(migrationDoc, err => {
        expect(err).toBeUndefined();
        void (async (): Promise<void> => {
          const docs = await client.db().collection(defaultCollectionName).find({}).toArray();
          expect(docs).toHaveLength(1);
          expect(docs[0]).toMatchObject(migrationDoc);
          done();
        })();
      });
    });
  });
});
