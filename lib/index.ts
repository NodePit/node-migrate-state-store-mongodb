import { MongoClient, Db } from 'mongodb';
import { promisify } from 'util';

interface Options {
  uri: string;
  collectionName?: string;
  /** Optionally specify a collection to use for locking. This is intended for
   * clusters with multiple nodes to ensure that not more than one migration
   * can run at any given time. */
  lockCollectionName?: string;
}

export class MongoStateStore {
  private readonly collectionName: string;
  private readonly mongodbHost: string;
  private readonly lockCollectionName?: string;

  constructor(objectOrHost: Options | string) {
    this.mongodbHost = typeof objectOrHost === 'string' ? objectOrHost : objectOrHost.uri;
    this.collectionName = (objectOrHost as Options).collectionName ?? 'migrations';
    this.lockCollectionName = typeof objectOrHost !== 'string' ? objectOrHost.lockCollectionName : undefined;
  }

  load(fn: (err?: any, set?: any) => void): void {
    this.doWithErrorHandling(fn, async db => {
      await this.acquireLock(db);
      const result = await db.collection(this.collectionName).find({}).toArray();
      if (result.length > 1) {
        throw new Error(`Expected exactly one result, but got ${result.length}`);
      }
      if (result.length === 0) {
        console.log('No migrations found, probably running the very first time');
        return {};
      }
      return result[0];
    });
  }

  save(set: any, fn: (err?: any) => void): void {
    const { migrations, lastRun } = set;
    this.doWithErrorHandling(fn, async db => {
      try {
        await db.collection(this.collectionName).replaceOne({}, { migrations, lastRun }, { upsert: true });
      } finally {
        await this.releaseLock(db);
      }
    });
  }

  private doWithErrorHandling(fn: (err?: any, set?: any) => void, actionCallback: (db: Db) => Promise<any>): void {
    (async () => {
      let client: MongoClient | null = null;
      try {
        client = await MongoClient.connect(this.mongodbHost);
        const db = client.db();
        const result = await actionCallback(db);
        fn(undefined, result);
      } catch (err) {
        fn(err);
      } finally {
        if (client) {
          try {
            await client.close();
          } catch (err) {
            // ignore
          }
        }
      }
    })().catch(() => {
      // ignore (handled via fn above)
    });
  }

  // locking

  private async acquireLock(db: Db): Promise<void> {
    if (typeof this.lockCollectionName !== 'string') return; // nothing to lock
    const collection = db.collection(this.lockCollectionName);
    // index is needed for atomicity:
    // https://docs.mongodb.com/manual/reference/method/db.collection.update/#use-unique-indexes
    // https://groups.google.com/forum/#!topic/mongodb-user/-fucdS-7kIU
    // https://stackoverflow.com/questions/33346175/mongodb-upsert-operation-seems-not-atomic-which-throws-duplicatekeyexception/34784533
    await collection.createIndex({ lock: 1 }, { unique: true });
    let showMessage = true;
    for (;;) {
      const result = await collection.updateOne({ lock: 'lock' }, { $set: { lock: 'lock' } }, { upsert: true });
      const lockAcquired = result.upsertedCount > 0;
      if (lockAcquired) {
        break;
      }
      if (showMessage) {
        console.log('Waiting for migration lock release …');
        showMessage = false;
      }
      await promisify(setTimeout)(100);
    }
  }

  private async releaseLock(db: Db): Promise<void> {
    if (typeof this.lockCollectionName !== 'string') return; // nothing to release
    await db.collection(this.lockCollectionName).deleteOne({ lock: 'lock' });
  }
}
