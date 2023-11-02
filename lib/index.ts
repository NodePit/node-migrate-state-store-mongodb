import * as migrate from 'migrate';
import { MongoClient, Db } from 'mongodb';
import { callbackify, promisify } from 'util';

interface Options {
  uri: string;
  collectionName?: string;
  /** Optionally specify a collection to use for locking. This is intended for
   * clusters with multiple nodes to ensure that not more than one migration
   * can run at any given time. You must use the `synchronizedMigration` or
   * `synchronizedUp` function, instead of triggering the migration via
   * `migrate` directly. */
  lockCollectionName?: string;
}

export type MongoMigrationOptions = migrate.MigrationOptions & { stateStore: MongoStateStore };

export class MongoStateStore {
  private readonly collectionName: string;
  readonly mongodbHost: string;
  readonly lockCollectionName?: string;

  constructor(objectOrHost: Options | string) {
    this.mongodbHost = typeof objectOrHost === 'string' ? objectOrHost : objectOrHost.uri;
    this.collectionName = (objectOrHost as Options).collectionName ?? 'migrations';
    this.lockCollectionName = typeof objectOrHost !== 'string' ? objectOrHost.lockCollectionName : undefined;
  }

  load(fn: (err?: any, set?: any) => void): void {
    callbackify<any>(() => {
      return dbRequest(this.mongodbHost, async db => {
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
    })(fn);
  }

  save(set: any, fn: (err?: any) => void): void {
    const { migrations, lastRun } = set;
    callbackify<void>(() =>
      dbRequest(this.mongodbHost, async db => {
        await db.collection(this.collectionName).replaceOne({}, { migrations, lastRun }, { upsert: true });
      })
    )(fn);
  }
}

/**
 * Wraps the migrations with a lock. This prevents in clustered
 * environments that the migrations run on more than one machine simultaneously.
 * To use the locking functionality, you must set the `lockCollectionName`
 * in the `MongoStateStore` options.
 *
 * Example usage:
 *
 * ```
 * await synchronizedMigration({
 *   stateStore: new MongoStateStore({
 *     uri: 'mongodb://localhost/db',
 *     lockCollectionName: 'migrationlock'
 *   })
 * }, async migrationSet => {
 *   // one instance at a time
 *   await promisify(loadedSet.up).call(loadedSet);
 * })
 * ```
 *
 * @param opts The migration options
 * @param callback Callback which is guaranteed to be run synchronized, i.e.
 *                 only on one instance at a given time
 */
export async function synchronizedMigration(
  opts: MongoMigrationOptions,
  callback: (set: migrate.MigrationSet) => Promise<void>
): Promise<void> {
  if (!opts.stateStore) {
    throw new Error('No `stateStore` in migration options');
  }
  const stateStore = opts.stateStore;
  if (!(stateStore instanceof MongoStateStore)) {
    throw new Error('Given `stateStore` is not `MongoStateStore`');
  }
  const lockCollectionName = stateStore.lockCollectionName;
  if (typeof lockCollectionName !== 'string') {
    throw new Error('`lockCollectionName` in MongoStateStore is not set');
  }

  try {
    await acquireLock(stateStore.mongodbHost, lockCollectionName);
    const set = await promisify(migrate.load)(opts);
    await callback(set);
  } finally {
    await releaseLock(stateStore.mongodbHost, lockCollectionName);
  }
}

export async function synchronizedUp(opts: MongoMigrationOptions): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  await synchronizedMigration(opts, async loadedSet => promisify(loadedSet.up).call(loadedSet));
}

async function dbRequest<T>(url: string, callback: (db: Db) => T | Promise<T>): Promise<T> {
  let client: MongoClient | undefined;
  try {
    client = await MongoClient.connect(url);
    const db = client.db();
    return await callback(db);
  } finally {
    await client?.close();
  }
}

async function acquireLock(url: string, lockCollectionName: string): Promise<void> {
  await dbRequest(url, async db => {
    const collection = db.collection(lockCollectionName);
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
  });
}

async function releaseLock(url: string, lockCollectionName: string): Promise<void> {
  await dbRequest(url, db => db.collection(lockCollectionName).deleteOne({ lock: 'lock' }));
}
