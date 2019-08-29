# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
## Changed
- `insert` returns ID of the object inserted
- `save` returns ID of the object if it was inserted / updated

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