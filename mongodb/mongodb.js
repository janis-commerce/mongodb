'use strict';

const { MongoClient, ObjectID } = require('mongodb');

const { pick } = require('lodash');

const logger = require('@janiscommerce/logger');

const MongoDBError = require('./mongodb-error');

const DEFAULT_LIMIT = 500;

class MongoDB {

	constructor(config) {
		this.config = config;
	}

	async checkConn() {
		if(!this.client) {
			this.client = await MongoClient.connect(this.config.host, {
				useNewUrlParser: true
			});
		}
	}

	/**
	 * Format an index for mongodb
	 *
	 * @param {<type>} index The index
	 * @param {mixed} string with a simple index or array with complex index
	 */
	formatIndex(index) {

		const formattedIndex = {};

		if(!Array.isArray(index))
			index = [index];

		for(const indexItem of index)
			formattedIndex[indexItem] = 1; // 1 for asc (default)

		return formattedIndex;
	}

	/**
	 * Create indexes
	 *
	 * @param {Object} model The model
	 * @return {Promise} { description_of_the_return_value }
	 */
	async createIndexes(model) {

		await this.checkConn();

		const db = this.client.db(model.dbname);

		logger.info(`Creating indexes for ${model.dbname}.${model.getTable()}`);

		if(model.constructor.uniqueIndexes) {
			model.constructor.uniqueIndexes.forEach(index => {
				db.collection(model.getTable())
					.createIndex(this.formatIndex(index), {
						unique: true
					});
			});
		}

		if(model.constructor.indexes) {
			model.constructor.indexes.forEach(index => {
				db.collection(model.getTable())
					.createIndex(this.formatIndex(index));
			});
		}
	}

	/* eslint-disable no-underscore-dangle */
	prepareFields(fields) {
		if(fields._id)
			fields._id = ObjectID(fields._id);
	}
	/* eslint-enable no-underscore-dangle */

	async get(model, params) {

		await this.checkConn();

		const db = this.client.db(model.dbname);

		const limit = params.limit || DEFAULT_LIMIT;

		const filters = params.filters ? ({ ...params.filters }) : {};
		this.prepareFields(filters);

		return db.collection(model.getTable())
			.find(filters)
			.limit(limit)
			.toArray();
	}

	getFilter(model, item) {

		if(!model.constructor.indexes)
			throw new MongoDBError(`Model requires indexes. See ${model.constructor.name}.indexes`, MongoDBError.codes.MODEL_EMPTY_INDEXES);

		let filter;

		for(let index of model.constructor.indexes) {

			if(!Array.isArray(index))
				index = [index];

			filter = pick(item, index);

			if(Object.keys(filter).length === index.length)
				break;

			filter = {};
		}

		if(!Object.keys(filter).length)
			throw new MongoDBError(`Operation requires indexes. See ${model.constructor.name}.indexes`, MongoDBError.codes.EMPTY_INDEXES);

		return filter;
	}

	async save(model, item) {

		await this.checkConn();

		const db = this.client.db(model.dbname);

		const filter = this.getFilter(model, item);

		const setItem = { ...item };
		this.prepareFields(setItem);

		const res = await db.collection(model.getTable())
			.updateOne(filter, {
				$set: setItem,
				$currentDate: { lastModified: true },
				$setOnInsert: { dateCreated: new Date() }
			}, { upsert: true });

		return res.matchedCount === 1 || res.upsertedCount === 1;
	}

	async insert(model, item) {

		await this.checkConn();

		const db = this.client.db(model.dbname);

		try {

			const setItem = { ...item };

			setItem.$setOnInsert = {
				dateCreated: new Date()
			};

			this.prepareFields(setItem);

			const res = await db.collection(model.getTable())
				.insertOne(setItem);

			return !!res.result.ok;

		} catch(error) {
			return false;
		}
	}

	async update(model, values, filter) {

		await this.checkConn();

		const db = this.client.db(model.dbname);

		const updateValues = { ...values };
		this.prepareFields(updateValues);

		const updateData = {
			$set: updateValues,
			$currentDate: { lastModified: true }
		};

		const res = await db.collection(model.getTable())
			.updateMany(filter, updateData);

		return res.modifiedCount;
	}

	async multiInsert(model, items) {

		await this.checkConn();

		const db = this.client.db(model.dbname);

		items.forEach(item => {
			item.$setOnInsert = { dateCreated: new Date() };
		});

		const res = await db.collection(model.getTable())
			.insertMany(items);

		return !!res.result.ok;
	}

	async multiSave(model, items) {

		await this.checkConn();

		const db = this.client.db(model.dbname);

		const updateItems = items.map(item => {

			const filter = this.getFilter(model, item);
			const update = {
				$set: item,
				$currentDate: { lastModified: true },
				$setOnInsert: { dateCreated: new Date() }
			};

			return { updateOne: { filter, update, upsert: true } };

		}).filter(Boolean);

		if(!updateItems.length)
			return false;

		const res = await db.collection(model.getTable())
			.bulkWrite(updateItems);

		return !!res.result.ok;
	}

}

module.exports = MongoDB;
