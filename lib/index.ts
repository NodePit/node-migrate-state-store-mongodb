import { MongoClient, Db } from 'mongodb';
import { Options } from './interfaces/options.interface';

export class MongoStateStore {
  private readonly collectionName: string;
  private readonly mongodbHost: string;

  constructor(objectOrHost: Options | string) {
    this.mongodbHost = typeof objectOrHost === 'string' ? objectOrHost : objectOrHost.uri;
    this.collectionName = (objectOrHost as Options).collectionName ?? 'migrations';
  }

  load(fn: (err?: any, set?: any) => void): void {
    void (
      /* promise handled by fn */ this.doWithErrorHandling(fn, async db => {
        const result = await db.collection(this.collectionName).find({}).toArray();
        if (result.length > 1) {
          throw new Error(`Expected exactly one result, but got ${result.length}`);
        }
        if (result.length === 0) {
          console.log('No migrations found, probably running the very first time');
          return {};
        }
        return result[0];
      })
    );
  }

  save(set: any, fn: (err?: any) => void): void {
    const { migrations, lastRun } = set;
    void (
      /* promise handled by fn */ this.doWithErrorHandling(fn, db =>
        db.collection(this.collectionName).replaceOne({}, { migrations, lastRun }, { upsert: true })
      )
    );
  }

  private async doWithErrorHandling(
    fn: (err?: any, set?: any) => void,
    actionCallback: (db: Db) => Promise<any>
  ): Promise<void> {
    let client: MongoClient | null = null;
    try {
      client = await MongoClient.connect(this.mongodbHost, { useNewUrlParser: true });
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
  }
}
