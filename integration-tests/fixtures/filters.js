'use strict';

const assert = require('node:assert').strict;

const TestModel = require('./_model');
const { TestModelWithFields, TestModelWithCustomId } = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError, createModelWithFields } = require('./_helpers');

describe('Filters (through get())', () => {

	const PARENT_ID = '5f8a7b2c9d1e4f0012345678';
	const OTHER_PARENT_ID = '5f8a7b2c9d1e4f0012345679';

	const getNames = async (model, filters) => {

		const result = await getMongodbInstance().get(model, { filters, order: { name: 'asc' } });

		return result.map(({ name }) => name);
	};

	const seed = async () => {

		const model = new TestModelWithFields();

		await getMongodbInstance().multiInsert(model, [
			{
				name: 'Alice',
				age: 10,
				score: 1,
				tags: ['red', 'big'],
				note: 'Hello World',
				optional: 'set',
				parentId: PARENT_ID,
				items: [{ sku: 'x', qty: 1 }, { sku: 'y', qty: 5 }],
				address: { city: 'Rosario' },
				birthDate: new Date('2000-01-01T00:00:00.000Z'),
				code: 'ABC',
				dateCreated: new Date('2020-01-01T00:00:00.000Z')
			},
			{
				name: 'Bob',
				age: 20,
				score: 2,
				tags: ['blue'],
				note: 'hello world',
				parentId: OTHER_PARENT_ID,
				items: [{ sku: 'x', qty: 10 }],
				address: { city: 'Cordoba' },
				birthDate: new Date('2001-01-01T00:00:00.000Z'),
				code: 'XYZ',
				dateCreated: new Date('2021-01-01T00:00:00.000Z')
			},
			{
				name: 'Carol',
				age: 30,
				score: 3,
				tags: ['red', 'small'],
				note: '123-456',
				dateCreated: new Date('2022-01-01T00:00:00.000Z')
			},
			{
				name: 'Dave',
				age: 40,
				score: 4,
				tags: [],
				note: 'Ñandú',
				dateCreated: new Date('2023-01-01T00:00:00.000Z')
			}
		]);

		return model;
	};

	afterEach(async () => {
		await cleanCollection();
	});

	context('Filter types', () => {

		it('equal: Should match the exact value, by default and with the explicit type', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { score: 2 }), ['Bob']);
			assert.deepEqual(await getNames(model, { score: { type: 'equal', value: 2 } }), ['Bob']);
			assert.deepEqual(await getNames(model, { score: { value: 2 } }), ['Bob']);
		});

		it('notEqual: Should exclude the value', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { score: { type: 'notEqual', value: 2 } }), ['Alice', 'Carol', 'Dave']);
		});

		it('greater: Should match values greater than the given one', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { score: { type: 'greater', value: 2 } }), ['Carol', 'Dave']);
		});

		it('greaterOrEqual: Should match values greater or equal, also by default through the field type', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { score: { type: 'greaterOrEqual', value: 2 } }), ['Bob', 'Carol', 'Dave']);
			// `age` is defined with type greaterOrEqual in the model fields
			assert.deepEqual(await getNames(model, { age: 30 }), ['Carol', 'Dave']);
		});

		it('lesser: Should match values lesser than the given one', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { score: { type: 'lesser', value: 2 } }), ['Alice']);
		});

		it('lesserOrEqual: Should match values lesser or equal', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { score: { type: 'lesserOrEqual', value: 2 } }), ['Alice', 'Bob']);
		});

		it('in: Should match any of the values, with explicit type and by default when the value is an array', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { score: { type: 'in', value: [1, 3] } }), ['Alice', 'Carol']);
			assert.deepEqual(await getNames(model, { score: [1, 3] }), ['Alice', 'Carol']);
			assert.deepEqual(await getNames(model, { score: { value: [1, 3] } }), ['Alice', 'Carol']);
		});

		it('in: Should be the default type of a field defined with type in', async () => {

			const model = await seed();

			// `tags` is defined with type in in the model fields
			assert.deepEqual(await getNames(model, { tags: ['blue', 'small'] }), ['Bob', 'Carol']);
		});

		it('notIn: Should exclude every one of the values', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { score: { type: 'notIn', value: [1, 3] } }), ['Bob', 'Dave']);
		});

		it('all: Should match arrays containing every value', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { tags: { type: 'all', value: ['red', 'big'] } }), ['Alice']);
			assert.deepEqual(await getNames(model, { tags: { type: 'all', value: ['red'] } }), ['Alice', 'Carol']);
		});

		it('exists: Should match documents that have (or do not have) the field', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { optional: { type: 'exists', value: true } }), ['Alice']);
			assert.deepEqual(await getNames(model, { optional: { type: 'exists', value: false } }), ['Bob', 'Carol', 'Dave']);
		});

		it('elemMatch: Should match arrays with an element matching every condition', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { items: { type: 'elemMatch', value: { sku: 'x', qty: { $gt: 5 } } } }), ['Bob']);
			assert.deepEqual(await getNames(model, { items: { type: 'elemMatch', value: { sku: 'y', qty: { $gt: 5 } } } }), []);
		});

		it('search: Should match as a case insensitive regex when the value has letters', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { note: { type: 'search', value: 'HELLO' } }), ['Alice', 'Bob']);
			assert.deepEqual(await getNames(model, { note: { type: 'search', value: 'wor' } }), ['Alice', 'Bob']);
		});

		it('search: Should be case insensitive for letters with accents', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { note: { type: 'search', value: 'ÑANDÚ' } }), ['Dave']);
		});

		it('search: Should match when the value has no letters', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { note: { type: 'search', value: '123-4' } }), ['Carol']);
			assert.deepEqual(await getNames(model, { note: { type: 'search', value: '^[0-9]+' } }), ['Carol']);
		});

		it('caseSensitiveSearch: Should match as a case sensitive regex', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { note: { type: 'caseSensitiveSearch', value: 'Hello' } }), ['Alice']);
			assert.deepEqual(await getNames(model, { note: { type: 'caseSensitiveSearch', value: 'HELLO' } }), []);
		});

		it('custom $xxx: Should pass a mongo operator as the type', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { score: { type: '$mod', value: [2, 0] } }), ['Bob', 'Dave']);
		});

		it('raw: Should pass the value without any modification', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { score: { raw: true, value: { $gt: 2, $lt: 4 } } }), ['Carol']);
		});

		it('raw: Should not convert the id string of a raw filter', async () => {

			const model = await seed();

			const [{ id }] = await getMongodbInstance().get(model, { filters: { name: 'Alice' } });

			assert.deepEqual(await getNames(model, { _id: { raw: true, value: id } }), []);
		});

	});

	context('Text and geospatial filters', () => {

		it('text: Should match using the text index, case insensitive', async () => {

			const model = await seed();

			await getMongodbInstance().createIndex(model, { name: 'note_text', key: { note: 'text' } });

			assert.deepEqual(await getNames(model, { note: { type: 'text', value: 'HELLO' } }), ['Alice', 'Bob']);
			assert.deepEqual(await getNames(model, { note: { type: 'text', value: 'HELLO' }, score: 1 }), ['Alice']);
		});

		it('text: Should reject with code 4 when there is no text index', async () => {

			const model = await seed();

			// 27 = IndexNotFound
			await assertDriverError(getMongodbInstance().get(model, { filters: { note: { type: 'text', value: 'hello' } } }), 27);
		});

		context('with a 2dsphere index', () => {

			const seedLocations = async () => {

				const model = new TestModel();
				const mongodb = getMongodbInstance();

				await mongodb.multiInsert(model, [
					{ name: 'Far', location: { type: 'Point', coordinates: [50, 50] } },
					{ name: 'Origin', location: { type: 'Point', coordinates: [0, 0] } },
					{ name: 'Near', location: { type: 'Point', coordinates: [0.01, 0] } }
				]);

				await mongodb.createIndex(model, { name: 'location_2dsphere', key: { location: '2dsphere' } });

				return model;
			};

			it('nearSphere: Should match points near the given one, ordered by distance', async () => {

				const model = await seedLocations();

				const result = await getMongodbInstance().get(model, {
					filters: {
						location: { type: 'nearSphere', value: { $geometry: { type: 'Point', coordinates: [0, 0] }, $maxDistance: 5000 } }
					}
				});

				assert.deepEqual(result.map(({ name }) => name), ['Origin', 'Near']);
			});

			it('geoIntersects: Should match geometries intersecting the given one', async () => {

				const model = await seedLocations();

				const polygon = { type: 'Polygon', coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]] };

				assert.deepEqual(await getNames(model, { location: { type: 'geoIntersects', value: { $geometry: polygon } } }), ['Near', 'Origin']);
			});

		});

		it('nearSphere: Should reject with code 4 when there is no geospatial index', async () => {

			const model = new TestModel();

			await getMongodbInstance().insert(model, { name: 'Origin', location: { type: 'Point', coordinates: [0, 0] } });

			const filters = {
				location: { type: 'nearSphere', value: { $geometry: { type: 'Point', coordinates: [0, 0] }, $maxDistance: 5000 } }
			};

			// 291 = NoQueryExecutionPlans
			await assertDriverError(getMongodbInstance().get(model, { filters }), 291);
		});

	});

	context('Combinations and model fields', () => {

		it('Should combine several filters as AND', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { score: { type: 'greater', value: 1 }, tags: { type: 'all', value: ['red'] } }), ['Carol']);
		});

		it('Should merge several filters of the same field', async () => {

			await seed();

			// Two filters that resolve to the same stored field are merged in one condition
			const ModelWithRange = createModelWithFields({
				scoreFrom: { field: 'score', type: 'greaterOrEqual' },
				scoreTo: { field: 'score', type: 'lesserOrEqual' }
			});

			assert.deepEqual(await getNames(new ModelWithRange(), { scoreFrom: 2, scoreTo: 3 }), ['Bob', 'Carol']);
		});

		it('Should combine an array of filters as OR', async () => {

			const model = await seed();

			const filters = [{ fullName: 'Alice' }, { score: 3 }, { note: { type: 'search', value: 'ñandú' } }];

			assert.deepEqual(await getNames(model, filters), ['Alice', 'Carol', 'Dave']);
		});

		it('Should return everything with empty filters and OR with an empty array', async () => {

			const model = await seed();

			assert.equal((await getNames(model, {})).length, 4);
			assert.equal((await getNames(model, [])).length, 4);
		});

		it('field: Should filter by the stored field name', async () => {

			const model = await seed();

			// `fullName` is stored as `name`
			assert.deepEqual(await getNames(model, { fullName: 'Bob' }), ['Bob']);
			assert.deepEqual(await getNames(model, { fullName: { type: 'search', value: 'ali' } }), ['Alice']);
		});

		it('mapper: Should apply a string mapper to the value', async () => {

			const model = await seed();

			// `birthDate` is defined with mapper toDate
			assert.deepEqual(await getNames(model, { birthDate: '2000-01-01T00:00:00.000Z' }), ['Alice']);
			assert.deepEqual(await getNames(model, { birthDate: { type: 'greater', value: '2000-06-01' } }), ['Bob']);
		});

		it('mapper: Should apply a function mapper to the value, and to every value of an array', async () => {

			const model = await seed();

			// `code` is defined with a mapper that upper-cases the value
			assert.deepEqual(await getNames(model, { code: 'abc' }), ['Alice']);
			assert.deepEqual(await getNames(model, { code: ['abc', 'xyz'] }), ['Alice', 'Bob']);
		});

		it('mapper: Should apply the default toDate mapper to dateCreated and dateModified based fields', async () => {

			await seed();

			const ModelWithDates = createModelWithFields({
				dateCreatedFrom: { field: 'dateCreated', type: 'greaterOrEqual' },
				dateCreatedTo: { field: 'dateCreated', type: 'lesserOrEqual' }
			});

			const model = new ModelWithDates();

			assert.deepEqual(await getNames(model, { dateCreated: '2021-01-01T00:00:00.000Z' }), ['Bob']);
			assert.deepEqual(await getNames(model, { dateCreatedFrom: '2021-01-01T00:00:00.000Z', dateCreatedTo: '2022-06-01' }), ['Bob', 'Carol']);
		});

		it('mapper: Should not apply the default mapper when the field defines mapper false', async () => {

			await seed();

			const ModelWithoutMapper = createModelWithFields({ dateCreated: { mapper: false } });

			assert.deepEqual(await getNames(new ModelWithoutMapper(), { dateCreated: '2021-01-01T00:00:00.000Z' }), []);
		});

		it('Should filter nested fields using dot notation', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { 'address.city': 'Rosario' }), ['Alice']);
			assert.deepEqual(await getNames(model, { 'address.city': { type: 'search', value: 'cor' } }), ['Bob']);
		});

		it('isID: Should cast the string to ObjectId for fields marked as isID', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { parentId: PARENT_ID }), ['Alice']);
			assert.deepEqual(await getNames(model, { parentId: { type: 'notEqual', value: PARENT_ID } }), ['Bob', 'Carol', 'Dave']);
		});

		it('isID: Should cast every value of an array', async () => {

			const model = await seed();

			assert.deepEqual(await getNames(model, { parentId: [PARENT_ID, OTHER_PARENT_ID] }), ['Alice', 'Bob']);
		});

		it('id: Should map id to _id as ObjectId, with arrays and types', async () => {

			const model = await seed();

			const documents = await getMongodbInstance().get(model, { order: { name: 'asc' } });
			const [alice, bob, carol] = documents.map(({ id }) => id);

			assert.deepEqual(await getNames(model, { id: bob }), ['Bob']);
			assert.deepEqual(await getNames(model, { id: [alice, carol] }), ['Alice', 'Carol']);
			assert.deepEqual(await getNames(model, { id: { type: 'notEqual', value: bob } }), ['Alice', 'Carol', 'Dave']);
			assert.deepEqual(await getNames(model, { id: { type: 'notIn', value: [alice, bob] } }), ['Carol', 'Dave']);
		});

		it('hasCustomId: Should keep the id as string and filter by it', async () => {

			const model = new TestModelWithCustomId();
			const mongodb = getMongodbInstance();

			await mongodb.multiInsert(model, [
				{ id: 'custom-1', name: 'One' },
				{ id: 'custom-2', name: 'Two' }
			]);

			const result = await mongodb.get(model, { filters: { id: 'custom-2' } });

			assert.deepEqual(result.map(({ id, name }) => ({ id, name })), [{ id: 'custom-2', name: 'Two' }]);

			assert.deepEqual(await getNames(model, { id: ['custom-1', 'custom-2'] }), ['One', 'Two']);
		});

	});

});
