# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

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
