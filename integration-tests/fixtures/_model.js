/* eslint-disable max-classes-per-file */

'use strict';

const table = 'integration-tests';

const indexes = [
	{
		name: 'name',
		key: {
			name: 1
		},
		unique: true
	}
];

/**
 * Base model: no `fields`, no `hasCustomId`. Used by the existing fixtures.
 */
class TestModel {

	static get table() {
		return table;
	}

	static get indexes() {
		return indexes;
	}

}

/**
 * Model with `fields` exercising the filters/ids options:
 * - isID: `parentId` (filters and writes are cast to ObjectId)
 * - field: `fullName` filter is renamed to the `name` stored field
 * - type: `age` filters use `greaterOrEqual` and `tags` uses `in` by default
 * - mapper: `birthDate` uses the `toDate` string mapper, `code` a custom function mapper
 */
class TestModelWithFields extends TestModel {

	static get fields() {
		return {
			parentId: { isID: true },
			fullName: { field: 'name' },
			age: { type: 'greaterOrEqual' },
			tags: { type: 'in' },
			birthDate: { mapper: 'toDate' },
			code: { mapper: value => String(value).toUpperCase() }
		};
	}

}

/**
 * Model with `hasCustomId`: the `id` is stored as `_id` untouched (string, not ObjectId)
 */
class TestModelWithCustomId extends TestModel {

	static get hasCustomId() {
		return true;
	}

}

module.exports = TestModel;
module.exports.TestModel = TestModel;
module.exports.TestModelWithFields = TestModelWithFields;
module.exports.TestModelWithCustomId = TestModelWithCustomId;
