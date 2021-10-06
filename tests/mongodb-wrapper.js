'use strict';

const assert = require('assert');
const sinon = require('sinon');

const { MongoClient: RealMongoClient, ObjectID: RealObjectID } = require('mongodb');

const Events = require('@janiscommerce/events');

const { MongoWrapper, ObjectID } = require('../lib/mongodb-wrapper');

describe('ObjectID', () => {
	it('Should export the Mongo ObjectID', () => {
		assert.deepStrictEqual(ObjectID, RealObjectID);
	});
});

describe('MongoWrapper', () => {

	const config = {
		protocol: 'mongodb://',
		host: 'localhost',
		port: 27017,
		database: 'myDatabase',
		user: '',
		password: '',
		limit: 500
	};

	const connectionParams = {
		useNewUrlParser: true,
		useUnifiedTopology: true,
		writeConcern: { w: 1 }
	};

	beforeEach(() => {
		sinon.stub(RealMongoClient, 'connect');
		config.host = `${Date.now()}.localhost`;
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('makeQuery()', () => {

		class Model {
			static get table() {
				return 'myCollection';
			}
		}

		const model = new Model();

		it('Should reject if connection fails', async () => {

			RealMongoClient.connect.rejects(new Error('Connection error'));

			const callback = sinon.stub();

			const mongoWrapper = new MongoWrapper(config);
			await assert.rejects(() => mongoWrapper.makeQuery(model, callback));

			sinon.assert.notCalled(callback);
			sinon.assert.calledOnce(RealMongoClient.connect);
		});

		it('Should generate the connection string without user and password', async () => {

			RealMongoClient.connect.resolves({
				isConnected: sinon.stub().returns(false),
				db: sinon.stub().returns({
					collection: sinon.stub()
				}),
				close: sinon.stub()
			});

			const callback = sinon.stub();

			const mongoWrapper = new MongoWrapper(config);
			await mongoWrapper.makeQuery(model, callback);

			const connectionString = `mongodb://${config.host}:27017/${config.database}`;

			sinon.assert.calledOnceWithExactly(RealMongoClient.connect, connectionString, connectionParams);
		});

		it('Should generate the connection string with user and password', async () => {

			RealMongoClient.connect.resolves({
				isConnected: sinon.stub().returns(false),
				db: sinon.stub().returns({
					collection: sinon.stub()
				}),
				close: sinon.stub()
			});

			const callback = sinon.stub();

			const mongoWrapper = new MongoWrapper({
				...config,
				user: 'foo',
				password: 'bar'
			});
			await mongoWrapper.makeQuery(model, callback);

			const connectionString = `mongodb://foo:bar@${config.host}:27017/${config.database}`;

			sinon.assert.calledOnceWithExactly(RealMongoClient.connect, connectionString, connectionParams);
		});

		it('Should close the connection when janiscommerce.ended event was emitted', async () => {

			const closeStub = sinon.stub();

			RealMongoClient.connect.resolves({
				isConnected: sinon.stub().returns(false),
				db: sinon.stub().returns({
					collection: sinon.stub()
				}),
				close: closeStub
			});

			const callback = sinon.stub();

			const mongoWrapper = new MongoWrapper(config);
			await mongoWrapper.makeQuery(model, callback);

			const connectionString = `mongodb://${config.host}:27017/${config.database}`;

			sinon.assert.calledOnceWithExactly(RealMongoClient.connect, connectionString, connectionParams);

			Events.emit('janiscommerce.ended');

			sinon.assert.calledOnceWithExactly(closeStub);
		});

		it('Should call the callback, passing the collection defined by the model', async () => {

			const collection = {};
			const collectionStub = sinon.stub().returns(collection);

			RealMongoClient.connect.resolves({
				isConnected: sinon.stub().returns(false),
				db: sinon.stub().returns({
					collection: collectionStub
				}),
				close: sinon.stub()
			});

			const callback = sinon.stub();

			const mongoWrapper = new MongoWrapper({ ...config });
			await mongoWrapper.makeQuery(model, callback);

			sinon.assert.calledOnceWithExactly(collectionStub, 'myCollection');
			sinon.assert.calledOnceWithExactly(callback, collection);
		});

		it('Should connect only once for the same DB config key', async () => {

			RealMongoClient.connect.resolves({
				isConnected: sinon.stub().returns(true),
				db: sinon.stub().returns({
					collection: sinon.stub()
				}),
				close: sinon.stub()
			});

			const callback = sinon.stub();

			const mongoWrapper = new MongoWrapper({ ...config });

			await mongoWrapper.makeQuery(model, callback);
			await mongoWrapper.makeQuery(model, callback);

			const mongoWrapper2 = new MongoWrapper({ ...config, database: 'myDatabase2' });

			await mongoWrapper2.makeQuery(model, callback);

			sinon.assert.calledOnce(RealMongoClient.connect);
		});

		it('Should reconnect to the same DB if it\'s not connected', async () => {

			RealMongoClient.connect.resolves({
				isConnected: sinon.stub().returns(false),
				db: sinon.stub().returns({
					collection: sinon.stub()
				}),
				close: sinon.stub()
			});

			const callback = sinon.stub();

			const mongoWrapper = new MongoWrapper({ ...config });

			await mongoWrapper.makeQuery(model, callback);

			const mongoWrapper2 = new MongoWrapper({ ...config, database: 'myDatabase2' });

			await mongoWrapper2.makeQuery(model, callback);

			sinon.assert.calledTwice(RealMongoClient.connect);
		});
	});
});
