# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0-beta.0] – 2022-03-30

### Added
- Add lock mechanism to prevent running migrations simulataneously in clustered environments.

## [3.0.0] – 2021-10-03

### Changed
- Require MongoDB NodeJS driver [v4](https://github.com/mongodb/node-mongodb-native/blob/4.1/docs/CHANGES_4.0.0.md#nodejs-version) as `peerDependency` and adapt to new API
- Require at least NodeJS 12.9 ([according](https://github.com/mongodb/node-mongodb-native/blob/4.1/docs/CHANGES_4.0.0.md#nodejs-version) to updated MongoDB driver)

## [2.1.1] – 2020-09-09

### Fixed
- Set `useUnifiedTopology` flag to avoid deprecation warning

## [2.1.0] – 2020-08-26

### Added
- Allow to specify collection name for migrations state (kudos to [Dante Calderón](https://github.com/dantehemerson)) by instantiating the store with a configuration object

## [2.0.0] – 2020-04-28

### Changed
- Require at least NodeJS 10
- Set `useNewUrlParser` flag to avoid deprecation warning (potentially breaking -- check the MongoDB [documentation](https://docs.mongodb.com/manual/reference/connection-string/) and your URL string)
- Update tool chain (Jest, ESLint, Prettier)

### Added
- Comprehensive test suite

## [1.0.4] – 2020-01-04
## [1.0.3] – 2019-11-11
## [1.0.2] – 2019-07-06
## [1.0.1] – 2018-11-30
## [1.0.0] – 2018-11-30
