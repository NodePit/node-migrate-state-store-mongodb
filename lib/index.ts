import { MongoClient, Db } from 'mongodb';

export class MongoStateStore {

  static readonly collectionName = 'migrations';

  constructor (private mongodbHost: string) { }

  async load (fn: (err?: any, set?: any) => void) {
    this.doWithErrorHandling(async db => {
      const result = await db.collection(MongoStateStore.collectionName).find({}).toArray();
      if (result.length > 1) {
        return fn(new Error(`Expected exactly one result, but got ${result.length}`));
      }
      if (result.length === 0) {
        console.log('No migrations found, probably running the very first time');
        return fn(null, {});
      }
      fn(null, result[0]);
    }).catch(e => fn(e));
  }

  async save (set: any, fn: (err?: any) => void) {
    this.doWithErrorHandling(async db => {
      await db.collection(MongoStateStore.collectionName)
              .replaceOne({}, { migrations: set.migrations, lastRun: set.lastRun }, { upsert: true });
      fn();
    }).catch(e => fn(e));
  }

  private async doWithErrorHandling (actionCallback: (db: Db) => Promise<void>) {
    let client: MongoClient | null = null;
    try {
      client = await MongoClient.connect(this.mongodbHost, { useNewUrlParser: true });
      const db = client.db();
      await actionCallback(db);
    } finally {
      if (client) {
        await client.close();
      }
    }
  }

}
