import { MongoClient, Db } from 'mongodb';

interface Options {
  uri: string;
  collectionName?: string;
}

export class MongoStateStore {
  private readonly collectionName: string;
  private readonly mongodbHost: string;

  constructor(objectOrHost: Options | string) {
    this.mongodbHost = typeof objectOrHost === 'string' ? objectOrHost : objectOrHost.uri;
    this.collectionName = (objectOrHost as Options).collectionName ?? 'migrations';
  }

  load(fn: (err?: any, set?: any) => void): void {
    this.doWithErrorHandling(fn, async db => {
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
    this.doWithErrorHandling(fn, db =>
      db.collection(this.collectionName).replaceOne({}, { migrations, lastRun }, { upsert: true })
    );
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
}
