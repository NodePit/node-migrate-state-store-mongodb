# node-migrate state storage for MongoDB

[![Run Status](https://api.shippable.com/projects/5c015900e25f0c0700d869d4/badge?branch=master)]()
[![Coverage Badge](https://api.shippable.com/projects/5c015900e25f0c0700d869d4/coverageBadge?branch=master)]()
[![npm version](https://badge.fury.io/js/%40nodepit%2Fmigrate-state-store-mongodb.svg)](https://badge.fury.io/js/%40nodepit%2Fmigrate-state-store-mongodb)

This is a [state storage implementation](https://github.com/tj/node-migrate#custom-state-storage) for the [`node-migrate`](https://github.com/tj/node-migrate) framework. It will store your migation state in a MongoDB collection called `migrations` which contains a single document.

In case you’re using `node-migrate` for migrating your MongoDB, it makes sense to keep the state within the database itself, instead of a separate file which is used by `node-migrate` per default.

## Installation

```shell
$ yarn add @nodepit/migrate-state-store-mongodb
```

## Usage

```javascript
import * as migrate from 'migrate';
import { MongoStateStore } from 'migrate-state-store-mongodb';

migrate.load({
  stateStore: new MongoStateStore(MONGODB_HOST),
  // further configuration …
}, (err, set) => {
  // your code …
});
```

## Development

Install NPM dependencies with `yarn`.

To execute the tests, run the `test` task.

For the best development experience, make sure that your editor supports [TSLint](https://palantir.github.io/tslint/usage/third-party-tools/) and [EditorConfig](http://editorconfig.org).

## Releasing to NPM

Commit all changes and run the following:

```shell
$ npm login
$ npm version <update_type>
$ npm publish --access public
```

… where `<update_type>` is one of `patch`, `minor`, or `major`. This will update the `package.json`, and create a tagged Git commit with the version number.


## Contributing

Pull requests are very welcome. Feel free to discuss bugs or new features by opening a new [issue](https://github.com/NodePit/node-migrate-state-store-mongodb/issues).

- - -

Copyright [nodepit.com](https://nodepit.com), 2018
