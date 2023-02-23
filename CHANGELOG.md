# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.9.0] - 2023-02-23
### Added
- Using getter `hasCustomId()` from Model to have an `id` that is not an **ObjectId**

## [2.8.0] - 2023-02-22
### Changed
- Now methods `insert()`, `save()`, `multiInsert()`, `multiSave()` will write `dateCreated` field when received

## [2.7.0] - 2023-01-17
### Added
- Added params `fields` and `excludeFields` to be used on `find()` queries to reduce responses

## [2.6.1] - 2023-01-04
### Fixed
- Added `force=true` to connection close to fix File descriptor leak

## [2.6.0] - 2022-12-20
### Changed
- Updated `@janiscommerce/events` to make `async` the callback `janiscommerce.ended` to ensure to close connections

## [2.5.8] - 2022-12-12
### Changed
- Now `getTotals()` will return the totals of the whole collection without filters if `get()` is not called before

## [2.5.7] - 2022-07-22
### Changed
- Now `getTotals()` no performs a mongo query when length of results are lesser than the limit

## [2.5.6] - 2022-07-21
### Changed
- Using **mongodb** `estimatedDocumentCount()` when `getTotals()` is called for queries without `filters`

## [2.5.5] - 2022-07-15
### Changed
- `deleteAllDocuments()` methods now can receive `filter` to apply to the `deleteMany()` command

## [2.5.4] - 2022-07-14
### Removed
- Sort fixed `_id` to ensure sort consistency

## [2.5.3] - 2022-07-13
### Changed
- Not adding sort by `_id` when received "date field" in order parameter

## [2.5.2] - 2022-07-11
### Fixed
- Multiple concurrent connections do not leak any more

## [2.5.1] - 2022-06-27
### Fixed
- Added sort by `_id` by default to ensure sort consistency

## [2.5.0] - 2022-05-26
### Added
- Valid id struct getter

## [2.4.0] - 2022-05-19
### Added
- Methods `dropCollection` and `deleteAllDocuments`

## [2.3.2] - 2022-05-02
### Fixed
- Bug using `$unset` operator in stages in `update` method

## [2.3.1] - 2022-05-02
### Fixed
- Fixed error in `save` method, where it takes the id data to save from.

## [2.3.0] - 2022-04-21
### Added
- Now can use `aggregate` function.

### Fixed
- Now can use `$unset` operator in stages correctly.

## [2.2.1] - 2022-04-12
### Fixed
- Fix in `increment()`, internal bad argument `{}`

## [2.2.0] - 2022-03-02
### Added
- Now the `update` method accepts multiple item data

## [2.1.0] - 2022-03-02
### Added
- Added new validation to close connections through `CLOSE_MONGODB_CONNECTIONS` environment variable value.
- The deprecated `ObjectID` was changed to `ObjectId`.

## [2.0.2] - 2022-02-03
### Fixed
- Fix in `findOneAndUpdate`, bad argument `{}`

## [2.0.1] - 2022-02-03
### Fixed
- Closing connections in a more secure way

## [2.0.0] - 2022-01-31
### Added
- Closing connections when event `janiscommerce.ended` was emitted
- Events listened with `@janiscommerce/events`

### Changed
- Using `mongodb@4.3.1` drive **BREAKING CHANGE**
- Support for node 12 dropped **BREAKING CHANGE**

## [1.18.0] - 2021-07-07
### Added
- Query filter types `elemMatch`, `nearSphere` and `geoIntersects` are now supported
- You can pass an unknown filter type if it starts with `$` (for passing mongo raw types that are not being supported)

## [1.17.1] - 2021-04-15
### Fixed
- Avoid `writeConcern` duplication

## [1.17.0] - 2021-04-14
### Changed
- `update` Method now supports the options parameter.
- `writeConcern` config replace the top-level w config.

## [1.16.1] - 2021-02-08
### Changed
- `getIndexes` method now returns the whole index without any format

## [1.16.0] - 2020-11-09
### Added
- `dropDatabase` method

### Changed
- better `README.md` organization

## [1.15.0] - 2020-08-27
### Added
- GitHub actions for build, coverage and publish
- Support for unique indexes with new `indexes` _getter_

### Deprecated
- Indexes with `uniqueIndexes` _getter_

## [1.14.1] - 2020-05-29
### Fixed
- Text index search now works as expected

## [1.14.0] - 2020-05-27
### Added
- Added `text` filter type to search using text indexes

## [1.13.0] - 2020-05-05
### Added
- `save` and `multiSave` now accept mongo update operators, such as `$inc`

## [1.12.0] - 2020-02-21
### Added
- `update` now accepts values within mongo update operators (https://docs.mongodb.com/manual/reference/operator/update/)

## [1.11.0] - 2020-01-17
### Changed
- `multiInsert` returns Array with Items inserted

## [1.10.0] - 2020-01-14
### Added
- `setOnInsert` param in `save` and `multiSave`

## [1.9.0] - 2020-01-13
### Added
- `increment` method
- `getIndexes` method for getting the collection indexes
- `createIndex` method for creating an index into the collection
- `createIndexes` method for creating multiple indexes into the collection
- `dropIndex` method for dropping an index from the collection
- `dropIndexes` method for dropping multiple indexes from the collection

## [1.8.7] - 2019-12-31
### Fixed
- `save` method now handles properly autogenerated dates

## [1.8.6] - 2019-12-30
### Fixed
- Fix for OR filters with ensuring object IDs

## [1.8.5] - 2019-12-18
### Fixed
- Fix in filters with `null` value

## [1.8.4] - 2019-12-17
### Added
- `useUnifiedTopology` mongo option set to true
- `distinct` method is now documented

### Changed
- `search` filter type is now case insensitive

### Fixed
- Full refactor of the service to improve code quality and tests reliability

## [1.8.3] - 2019-12-10
### Fixed
- Fix in filters for Date fields

## [1.8.2] - 2019-12-05
### Fixed
- Filters by ID fixed for multiple values
- Tests improved to reflect mongo IDs as ObjectID

## [1.8.1] - 2019-12-05
### Fixed
- Multi value filters now search as `$in` when filter type is not defined

## [1.8.0] - 2019-12-05
### Added
- `isID` support in model fields for ObjectID filters

### Fixed
- Multi value filters now work as expected

## [1.7.2] - 2019-12-05
### Changed
- `save` uses `findAndModify` with `upsert: true` and `new: true`, to return always `_id`

## [1.7.1] - 2019-11-22
### Fixed
- `multiRemove` can remove multiple docs based on their IDs

## [1.7.0] - 2019-11-07
### Added
- `exists` filter type is now supported

## [1.6.1] - 2019-11-06
### Fixed
- `distinct()` method now works as expected

### Changed
- Error handling improved for debugging sessions

## [1.6.0] - 2019-11-06
### Added
- `distinct()` method to query all the distinct values of a field

## [1.5.3] - 2019-10-28
### Added
- package lllog

### Changed
- lodash.pick as direct dependecy

### Removed
- package @janiscommerce/logger
- useless index.js

## [1.5.2] - 2019-10-28
### Fixed
- Validation date type to ISOString
- Connection optimized

## [1.5.1] - 2019-10-02
### Fixed
- Multiple filters for the same field with different types

## [1.5.0] - 2019-09-30
### Added
- `filter-wrapper` Module
- Model filter handling
- `search` filter support
- nested filters documentation

### Fixed
- `notEqual` filter type

## [1.4.0] - 2019-09-12
### Added
- `config-validator` module
- `MongoDBConfigError` module
- config validations
- indexes and uniqueIndexes docs

## [1.3.3] - 2019-08-29
### Fixed
- Now `insert` returns ID of the object inserted, as it was expected
- Now `save` returns ID of the object if it was inserted / Unique Index used as filter if it was updated, as it was expected

## [1.3.2] - 2019-08-28
### Fixed
- `lastModified` field name was changed into `dateModified`

## [1.3.1] - 2019-08-28
### Fixed
- Filtering by multiple IDs now works properly

## [1.3.0] - 2019-07-30
### Added
- Order parameter for `get()` method
- `cleanFields()` method, used for remove the`lastModified` and `dateCreated` fields in update, save and multiSave methods.

### Fixed
- `multiSave()` upsert errors when saving items with id

## [1.2.1] - 2019-07-17
### Fixed
- Added write concern so inserts and updates don't fail in Atlas any more

## [1.2.0] - 2019-07-12
### Added
- Protocol field in config
- `userPrefix` getter

## [1.1.0] - 2019-07-05
### Added
- MongoDB wrapper
- Tests
- Travis & coveralls badges
- Readme
- remove and multiRemove methods
- `lib` folder into `package.json` files
- Git hooks
- `getTotals` method
- Internal MongoDB errors handling
- Mapping of `_id` from mongo into `id`
- Error handling for bad items in methods parameters
- User and password support
- Internal MongoDB errors handling in save, multiSave and remove methods

### Changed
- Database name is loaded from config instead model
- Changed modules files folder into `lib`
- Model `getTable()` method into `table` static getter
- `getFilter()` now only get filters from the unique indexes of the model
- `get()`, `update()` and `multiRemove()` can use any items in the filters
- host field in config not need mongodb protocol anymore

## [1.0.0] - 2019-05-17
### Added
- Initial version
