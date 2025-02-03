'use strict';

const assert = require('assert');
const { ObjectId } = require('mongodb');

const MongoDBFilters = require('../lib/mongodb-filters');

describe('MongoDBFilters', () => {

	describe('parseFilters()', () => {

		const getModel = fields => {
			class Model {
				static get fields() {
					return fields;
				}
			}

			return new Model();
		};

		const id = '5df0151dbc1d570011949d86';
		const id2 = '5df0151dbc1d570011949d87';
		const date = new Date();
		const dateCreated = new Date();
		dateCreated.setDate(dateCreated.getDate() - 2);
		const dateModified = new Date();
		dateModified.setDate(dateModified.getDate() - 1);

		it('Should return an empty object if no filters are passed', () => {
			assert.deepStrictEqual(MongoDBFilters.parseFilters(), {});
		});

		it('Should throw if invalid filters are passed', () => {
			assert.throws(() => MongoDBFilters.parseFilters(true));
			assert.throws(() => MongoDBFilters.parseFilters('invalid'));
			assert.throws(() => MongoDBFilters.parseFilters({
				dateCreated
			}, getModel({
				foo: true,
				dateCreated: {
					type: 'lesserOrEqual',
					mapper: []
				}
			})));
		});

		it('Should throw if invalid filter types are passed', () => {
			assert.throws(() => MongoDBFilters.parseFilters({
				foo: {
					type: 'unknown',
					value: 'bar'
				}
			}, getModel()));
		});

		it('Should return an empty object if an empty object passed', () => {
			assert.deepStrictEqual(MongoDBFilters.parseFilters({}), {});
		});

		it('Should return an empty object if an empty array passed', () => {
			assert.deepStrictEqual(MongoDBFilters.parseFilters([]), {});
		});

		it('Should accept an unknown filter type if it starts with the $ character', () => {

			const parsedFilters = MongoDBFilters.parseFilters({
				foo: { type: '$lt', value: 10 }
			}, getModel());

			assert.deepStrictEqual(parsedFilters, {
				foo: {
					$lt: 10
				}
			});
		});

		it('Should return the filters as \'equal\' or \'in\' filters when no custom configuration is set', () => {

			const parsedFilters = MongoDBFilters.parseFilters({
				foo: ['bar'],
				baz: 1,
				date,
				dateCreated: dateCreated.toISOString(),
				dateCreatedFrom: dateCreated.toISOString(),
				dateCreatedTo: dateCreated.toISOString(),
				dateModified: [dateModified.toISOString()],
				dateModifiedFrom: dateModified,
				dateModifiedFromCustom: dateModified.toISOString(),
				dateModifiedTo: dateModified.toISOString(),
				dateModifiedToCustom: dateModified.toISOString(),
				nullable: null,
				nullable2: { type: 'notEqual', value: null },
				id
			}, getModel({
				foo: true,
				dateModifiedTo: {
					type: 'lesserOrEqual',
					mapper: false
				},
				dateModifiedFromCustom: {
					type: 'greaterOrEqual',
					mapper: 'toDate'
				},
				dateModifiedToCustom: {
					type: 'lesserOrEqual',
					mapper: value => value.replace('Z', '')
				}
			}));

			assert.deepStrictEqual(parsedFilters, {
				foo: {
					$in: ['bar']
				},
				baz: {
					$eq: 1
				},
				date: {
					$eq: date
				},
				dateCreated: {
					$eq: dateCreated
				},
				dateCreatedFrom: {
					$eq: dateCreated
				},
				dateCreatedTo: {
					$eq: dateCreated
				},
				dateModified: {
					$in: [dateModified]
				},
				dateModifiedFrom: {
					$eq: dateModified
				},
				dateModifiedTo: {
					$lte: dateModified.toISOString()
				},
				dateModifiedFromCustom: {
					$gte: dateModified
				},
				dateModifiedToCustom: {
					$lte: dateModified.toISOString().replace('Z', '')
				},
				nullable: {
					$eq: null
				},
				nullable2: {
					$ne: null
				},
				id: {
					$eq: id
				}
			});
		});

		it('Should map the ID fields to ObjectIDs', () => {

			const parsedFilters = MongoDBFilters.parseFilters({
				foo: 'bar',
				baz: 1,
				date,
				id,
				id2: [id, id2]
			}, getModel({
				id: {
					isID: true
				},
				id2: {
					isID: true
				}
			}));

			assert.deepStrictEqual(parsedFilters, {
				foo: {
					$eq: 'bar'
				},
				baz: {
					$eq: 1
				},
				date: {
					$eq: date
				},
				id: {
					$eq: ObjectId(id)
				},
				id2: {
					$in: [ObjectId(id), ObjectId(id2)]
				}
			});
		});

		it('Should use the filters types of filters and model fields in that order', () => {

			const parsedFilters = MongoDBFilters.parseFilters({
				foo: 'bar',
				baz: {
					type: 'notEqual',
					value: 1
				},
				search: 'Some text',
				date,
				id
			}, getModel({
				id: {
					isID: true
				},
				foo: {
					type: 'search'
				},
				search: {
					type: 'text'
				}
			}));

			assert.deepStrictEqual(parsedFilters, {
				foo: {
					$regex: /bar/i
				},
				baz: {
					$ne: 1
				},
				$text: {
					$search: 'Some text',
					$caseSensitive: false,
					$diacriticSensitive: false
				},
				date: {
					$eq: date
				},
				id: {
					$eq: ObjectId(id)
				}
			});
		});

		it('Should return the filters as \'equal\' (not \'in\') filters if type is explicitly is set or passed', () => {

			const parsedFilters = MongoDBFilters.parseFilters({
				foo: ['bar', 'bar2'],
				baz: {
					type: 'equal',
					value: [1, 2]
				},
				date,
				id
			}, getModel({
				foo: {
					type: 'equal'
				}
			}));

			assert.deepStrictEqual(parsedFilters, {
				foo: {
					$eq: ['bar', 'bar2']
				},
				baz: {
					$eq: [1, 2]
				},
				date: {
					$eq: date
				},
				id: {
					$eq: id
				}
			});
		});

		it('Should return the OR filters if they are passed as an array', () => {

			const parsedFilters = MongoDBFilters.parseFilters([
				{
					foo: 'bar'
				},
				{
					baz: {
						type: 'equal',
						value: [1, 2]
					},
					date
				}
			], getModel());

			assert.deepStrictEqual(parsedFilters, {
				$or: [
					{
						foo: {
							$eq: 'bar'
						}
					},
					{
						baz: {
							$eq: [1, 2]
						},
						date: {
							$eq: date
						}
					}
				]
			});
		});

		it('Should use the filters names of the model fields', () => {

			const parsedFilters = MongoDBFilters.parseFilters({
				foo: 'bar'
			}, getModel({
				foo: {
					field: 'superfoo'
				}
			}));

			assert.deepStrictEqual(parsedFilters, {
				superfoo: {
					$eq: 'bar'
				}
			});
		});

		it('Should allow multiple filter criteria for the same field', () => {

			const parsedFilters = MongoDBFilters.parseFilters({
				dateFrom: new Date('2019-12-11T00:00:00.000Z'),
				dateTo: new Date('2019-12-11T23:59:59.999Z')
			}, getModel({
				dateFrom: {
					field: 'date',
					type: 'greaterOrEqual'
				},
				dateTo: {
					field: 'date',
					type: 'lesserOrEqual'
				}
			}));

			assert.deepStrictEqual(parsedFilters, {
				date: {
					$gte: new Date('2019-12-11T00:00:00.000Z'),
					$lte: new Date('2019-12-11T23:59:59.999Z')
				}
			});
		});

		it('Should return value without modification when received raw prop as true', () => {

			const parsedFilters = MongoDBFilters.parseFilters({
				products: {
					raw: true,
					value: { $exists: true, $ne: null, $not: { $size: 0 } }
				},
				status: 'active'
			}, getModel());

			assert.deepStrictEqual(parsedFilters, {
				products: { $exists: true, $ne: null, $not: { $size: 0 } },
				status: { $eq: 'active' }
			});
		});
	});
});
