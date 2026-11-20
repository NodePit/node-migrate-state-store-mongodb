# node-migrate state storage for MongoDB

[![Actions Status](https://github.com/NodePit/node-migrate-state-store-mongodb/workflows/CI/badge.svg)](https://github.com/NodePit/node-migrate-state-store-mongodb/actions)
[![codecov](https://codecov.io/gh/NodePit/node-migrate-state-store-mongodb/branch/master/graph/badge.svg)](https://codecov.io/gh/NodePit/node-migrate-state-store-mongodb)
[![npm version](https://badge.fury.io/js/%40nodepit%2Fmigrate-state-store-mongodb.svg)](https://badge.fury.io/js/%40nodepit%2Fmigrate-state-store-mongodb)

This is a [state storage implementation](https://github.com/tj/node-migrate#custom-state-storage) for the [`node-migrate`](https://github.com/tj/node-migrate) framework. It will store your migation state in a MongoDB collection called `migrations` which contains a single document.

In case you’re using `node-migrate` for migrating your MongoDB, it makes sense to keep the state within the database itself, instead of a separate file which is used by `node-migrate` per default.

## Installation

```shell
$ npm install @nodepit/migrate-state-store-mongodb
```

## Usage

Either create a wrapper script such as `run-migrations.ts` which calls the migration API like so:

```javascript
import * as migrate from 'migrate';
import { MongoStateStore } from '@nodepit/migrate-state-store-mongodb';

migrate.load(
  {
    stateStore: new MongoStateStore(MONGODB_HOST)
    // further configuration …
  },
  (err, set) => {
    // your code …
  }
);
```

Per default, the migrations are stored in a collection called `migrations`. If you want to customize the collection name, instantiate the `MongoStateStore` with an object instead:

```javascript
new MongoStateStore({ uri: MONGODB_HOST, collectionName: 'custom-migrations-collection' });
```

## Synchronization

If you’re running in a clustered environments with more than one node, there will likely be concurrency issues when more than one node tries to run a migration (also see [here](https://github.com/NodePit/node-migrate-state-store-mongodb/issues/30)). The plugin provides a locking mechanism which ensures that only one node can run migrations at a given time (and other ones will just wait until the migration has finished). For this, initialize `MongoStateStore` with a `lockCollectionName`:

```javascript
new MongoStateStore({
  uri: MONGODB_HOST,
  collectionName: 'migrations',
  lockCollectionName: 'migrationlock'
});
```

… then use the `synchronizedUp` function instead of calling `migrate.load` and `set.up` directly to ensure that the migration is only run on one instance at a time:

```javascript
import { MongoStateStore, synchronizedUp } from '@nodepit/migrate-state-store-mongodb';

await synchronizedUp({ stateStore: mongoStateStore });
```

## CLI Usage

Alternatively, you can also pass the store on the `migrate` CLI using the `--store` flag. For that, create a a file which has as default export a configured subclass with a zero-arg constructor of the `MongoStateStore`. See [here](https://github.com/NodePit/node-migrate-state-store-mongodb/issues/9#issuecomment-658018332) for details. You can then call `migrate up --store=./my-store.js`. Locking is not available in this case.

## Development

Install dependencies with `pnpm install`. pnpm downloads the Node.js version pinned in `devEngines` and uses it for every `pnpm run` and `pnpm exec`. Use `pnpm exec` instead of `npx`: npm rejects a Node.js version that differs from the pin.

To run the tests, run `pnpm test`. To check linting, formatting and types, run `pnpm run lint`.

To update dependencies, run `pnpm outdated` to see what’s behind, and `pnpm update -i --latest` to choose updates. Two are held back on purpose:

- `mongodb` stays within the major versions listed in `peerDependencies`. To support a new major version, add it there first.
- `@types/node` stays on the major version in `engines.node`, so the code can’t use APIs that the oldest supported Node.js lacks.

For the best development experience, make sure that your editor supports [ESLint](https://eslint.org/docs/user-guide/integrations), [Prettier](https://prettier.io/docs/editors) and [EditorConfig](https://editorconfig.org). The repository includes settings for VS Code: it formats on save, and offers to use the TypeScript version from `devDependencies`. Accept that once, so the editor reports the same errors as `pnpm run lint`.

## Releasing to NPM

Commit all changes and run the following:

```shell
$ pnpm login
$ pnpm version <update_type>
$ pnpm publish --access public
```

… where `<update_type>` is one of `patch`, `minor`, or `major`. This will update the `package.json`, and create a tagged Git commit with the version number.

## Contributing

Pull requests are very welcome. Feel free to discuss bugs or new features by opening a new [issue](https://github.com/NodePit/node-migrate-state-store-mongodb/issues).

---

Copyright [nodepit.com](https://nodepit.com), 2018 – 2025.
