# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- MongoDB wrapper
- Tests
- Travis & coveralls badges
- Readme
- remove and multiRemove methods
- `lib` folder into `package.json` files
- Git hooks
- `getTotals` method
- `update`, `save`, `multiSave`, `remove` and `multiRemove` now supports `_id` field as filter
- Internal MongoDB errors handling

### Changed
- Database name is loaded from config instead model
- Changed modules files folder into `lib`
- Model `getTable()` method into `table` static getter