'use strict';

const assert = require('node:assert').strict;

const MongoDB = require('../../lib/mongodb');
const MongoDBError = require('../../lib/mongodb-error');

const TestModel = require('./_model');
const { getMongodbInstance } = require('./_mongodb-instance');
const { cleanCollection, assertDriverError } = require('./_helpers');

describe('constructor', () => {

	const { hostname, port, pathname } = new URL(process.env.MONGODB_INTEGRATION_URI);

	const DATABASE = pathname.replace('/', '');
	const OTHER_DATABASE = `${DATABASE}-constructor`;

	afterEach(async () => {
		await cleanCollection();
		await new MongoDB({ host: hostname, port: Number(port), database: OTHER_DATABASE }).dropCollection(TestModel.table);
	});

	it('Should connect using host, port and database without connectionString', async () => {

		// A different host than the shared instance (127.0.0.1) forces a different configKey, so it opens its own client
		const mongodb = new MongoDB({ host: 'localhost', port: Number(port), database: DATABASE });

		assert.equal(mongodb.mongo.connectionString, `mongodb://localhost:${port}/${DATABASE}`);
		assert.notEqual(mongodb.mongo.configKey, getMongodbInstance().mongo.configKey);

		const model = new TestModel();

		await mongodb.insert(model, { name: 'Separated params' });

		const result = await mongodb.get(model, {});

		assert.deepEqual(result.map(({ name }) => name), ['Separated params']);

		// Same database as the shared connectionString instance
		const sharedResult = await getMongodbInstance().get(model, {});

		assert.deepEqual(sharedResult.map(({ name }) => name), ['Separated params']);

		// Each configKey has its own client
		const client = await mongodb.mongo.getDb().then(db => db.client);
		const sharedClient = await getMongodbInstance().mongo.getDb().then(db => db.client);

		assert.notEqual(client, sharedClient);
	});

	it('Should use the received database', async () => {

		const model = new TestModel();
		const otherMongodb = new MongoDB({ host: hostname, port: Number(port), database: OTHER_DATABASE });

		await otherMongodb.insert(model, { name: 'Other database' });

		assert.deepEqual((await otherMongodb.get(model, {})).map(({ name }) => name), ['Other database']);
		assert.deepEqual(await getMongodbInstance().get(model, {}), []);
	});

	it('Should build the connection string with protocol, user and password', () => {

		const mongodb = new MongoDB({
			protocol: 'mongodb://',
			host: 'some-host',
			port: 27018,
			database: 'some-db',
			user: 'some-user',
			password: 'some-pass'
		});

		assert.equal(mongodb.mongo.connectionString, 'mongodb://some-user:some-pass@some-host:27018/some-db');
	});

	it('Should use the connectionString over host and port, and the config database over the connectionString database', async () => {

		const mongodb = new MongoDB({
			connectionString: process.env.MONGODB_INTEGRATION_URI,
			host: 'ignored-host',
			port: 1,
			database: OTHER_DATABASE
		});

		assert.equal(mongodb.mongo.connectionString, process.env.MONGODB_INTEGRATION_URI);

		const model = new TestModel();

		await mongodb.insert(model, { name: 'Config database' });

		// Current behavior: config.database overrides the database of the connectionString
		const otherMongodb = new MongoDB({ host: hostname, port: Number(port), database: OTHER_DATABASE });

		assert.deepEqual((await otherMongodb.get(model, {})).map(({ name }) => name), ['Config database']);
		assert.deepEqual(await getMongodbInstance().get(model, {}), []);
	});

	it('Should apply the custom config limit as default limit in get(), getPaged() and getTotals()', async () => {

		const mongodb = new MongoDB({ connectionString: process.env.MONGODB_INTEGRATION_URI, limit: 2 });
		const model = new TestModel();

		await mongodb.multiInsert(model, Array.from({ length: 5 }, (item, index) => ({ name: `Item ${index}` })));

		const result = await mongodb.get(model, { order: { name: 'asc' } });

		assert.deepEqual(result.map(({ name }) => name), ['Item 0', 'Item 1']);

		const totals = await mongodb.getTotals(model);

		assert.deepEqual(totals, { total: 5, pageSize: 2, pages: 3, page: 1 });

		const pages = [];

		const pagedResult = await mongodb.getPaged(model, {}, (items, page) => pages.push({ length: items.length, page }));

		assert.deepEqual(pagedResult, { total: 5, batchSize: 2, pages: 3 });
		assert.deepEqual(pages, [{ length: 2, page: 1 }, { length: 2, page: 2 }, { length: 1, page: 3 }]);
	});

	it('Should prefer params.limit over the config limit', async () => {

		const mongodb = new MongoDB({ connectionString: process.env.MONGODB_INTEGRATION_URI, limit: 2 });
		const model = new TestModel();

		await mongodb.multiInsert(model, Array.from({ length: 5 }, (item, index) => ({ name: `Item ${index}` })));

		const result = await mongodb.get(model, { limit: 4 });

		assert.equal(result.length, 4);
	});

	it('Should reject with code 4 in the first operation when it can not connect (connection is lazy)', async () => {

		// Port 1 is not listening, and the host is not shared with the other instances (clients are cached by host)
		const mongodb = new MongoDB({ connectionString: 'mongodb://127.0.0.1:1/integration-tests?serverSelectionTimeoutMS=300' });

		// The connection error is wrapped twice: connect() wraps the driver error and get() wraps it again
		// Current behavior: previousError is a MongoDBError with code 4, the driver error is previousError.previousError
		const error = await assertDriverError(mongodb.get(new TestModel(), {}), MongoDBError.codes.MONGODB_INTERNAL_ERROR);

		assert.equal(error.previousError.previousError.name, 'MongoServerSelectionError');

		// The failed client is not kept in the cache: the next operation tries to connect again
		const secondError = await assertDriverError(mongodb.insert(new TestModel(), { name: 'Not inserted' }), MongoDBError.codes.MONGODB_INTERNAL_ERROR);

		assert.equal(secondError.previousError.previousError.name, 'MongoServerSelectionError');

		// A new connection attempt means a new driver error instance (a cached rejected client would repeat the same one)
		assert.notEqual(secondError.previousError.previousError, error.previousError.previousError);
	});

});
