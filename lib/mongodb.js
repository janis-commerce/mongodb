'use strict';

const { inspect } = require('util');

const { MongoWrapper: Mongo, ObjectID } = require('./mongodb-wrapper');

const MongoDBError = require('./mongodb-error');

const MongoDBFilters = require('./mongodb-filters');

const ConfigValidator = require('./config-validator');

/**
 * @class MongoDB
 * @classdesc MongoDB driver module
 */
class MongoDB {

	constructor(config) {

		const configWithDefaults = ConfigValidator.validate(config);

		this.config = {
			protocol: configWithDefaults.protocol,
			host: configWithDefaults.host,
			port: configWithDefaults.port,
			user: configWithDefaults.user,
			password: configWithDefaults.password,
			database: configWithDefaults.database,
			limit: configWithDefaults.limit
		};

		// Avoid protocol duplication
		this.config.host = this.config.host.replace(this.config.protocol, '');
	}

	async makeQuery(model, queryCallback) {

		const db = await Mongo.getDb(this.config);

		return queryCallback(db.collection(model.constructor.table));
	}

	parseSortingParams(order) {

		if(!order || typeof order !== 'object' || Array.isArray(order))
			return;

		const sortOptions = {
			asc: 1,
			desc: -1
		};

		const parsedSortParams = Object.entries(order)
			.reduce((acum, [key, value]) => {

				if(typeof value !== 'string' || !sortOptions[value])
					return acum;

				return {
					...acum,
					[key]: sortOptions[value]
				};
			}, {});

		if(!Object.keys(parsedSortParams).length)
			return;

		return parsedSortParams;
	}

	mapIdForMongo(object) {

		if(!object.id)
			return object;

		const { id, ...rest } = object;

		return {
			...rest,
			_id: this.ensureObjectId(id)
		};
	}

	ensureObjectId(id) {
		return typeof id === 'string' ? ObjectID(id) : id;
	}

	// mapToObjectId(value) {
	// 	return Array.isArray(value) ? value.map(v => this.ensureObjectId(v)) : this.ensureObjectId(value);
	// }

	ensureObjectIdsForWrite(model, item) {

		if(!model.constructor.fields || !Object.keys(model.constructor.fields).length)
			return item;

		const modelFields = model.constructor.fields;

		const parsedItem = {};

		for(const [field, value] of Object.entries(item))
			parsedItem[field] = modelFields[field] && modelFields[field].isID ? this.ensureObjectId(value) : value;

		return parsedItem;
	}

	// mapIdForClient(object) {

	// 	if(!object._id)
	// 		return object;

	// 	const { _id, ...rest } = object;

	// 	return {
	// 		...rest,
	// 		id: Array.isArray(_id) ? _id.map(String) : String(_id)
	// 	};
	// }

	/**
	 * Get distinct values of a field
	 *
	 * @param {Model} model Model instance
	 * @param {Object} params parameters (key and filters)
	 * @return {Array} mongodb get result
	 */
	async distinct(model, params = {}) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const { key } = params;

		if(!key || typeof key !== 'string')
			throw new MongoDBError(`Distinct key must be a string. Received ${inspect(key)}`, MongoDBError.codes.INVALID_DISTINCT_KEY);

		const filters = MongoDBFilters.parseFilters(params.filters, model);

		try {

			const res = await this.makeQuery(model, collection => collection.distinct(key, filters));

			return res;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Get data from mongodb database
	 * @param {Model} model Model instance
	 * @param {Object} params parameters (limit and filters)
	 * @returns {Array} mongodb get result
	 */
	async get(model, params = {}) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const limit = params.limit || this.config.limit;
		const page = params.page || 1;
		const order = this.parseSortingParams(params.order);
		const filters = MongoDBFilters.parseFilters(params.filters, model);

		try {

			const res = await this.makeQuery(model, collection => collection
				.find(this.mapIdForMongo(filters))
				.sort(order)
				.skip((limit * page) - limit)
				.limit(limit)
				.toArray());

			model.lastQueryEmpty = !res.length;
			model.totalsParams = {
				limit,
				page,
				filters,
				order
			};

			return res;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	getFilterForItem(model, item) {

		if(item._id)
			return { _id: item._id };

		if(!model.constructor.uniqueIndexes || !model.constructor.uniqueIndexes.length) {
			throw new MongoDBError(`Model requires unique indexes. See ${model.constructor.name}.uniqueIndexes`,
				MongoDBError.codes.MODEL_EMPTY_UNIQUE_INDEXES);
		}

		for(let index of model.constructor.uniqueIndexes) {

			if(!Array.isArray(index))
				index = [index];

			const filter = index
				.map(indexField => item[indexField])
				.filter(indexValue => indexValue !== undefined);

			if(filter.length === index.length) {
				return filter.reduce((acum, value, idx) => {
					return {
						...acum,
						[index[idx]]: value
					};
				}, {});
			}
		}

		throw new MongoDBError(`No unique indexes could be matched. See ${model.constructor.name}.uniqueIndexes`, MongoDBError.codes.EMPTY_UNIQUE_INDEXES);
	}

	/**
	 * Insert/update one element into the database
	 * @param {Model} model Model instance
	 * @param {Object} item item
	 * @returns {String} ID
	 */
	async save(model, item = {}) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const mongoItem = this.ensureObjectIdsForWrite(model, this.mapIdForMongo(item));

		const filters = MongoDBFilters.parseFilters(this.getFilterForItem(model, mongoItem), model);

		try {

			const res = await this.makeQuery(model, collection => collection
				.findAndModify(filters, {}, {
					$set: mongoItem,
					$currentDate: { dateModified: true },
					$setOnInsert: { dateCreated: new Date() }
				}, { upsert: true, new: true }));

			return res && res.value && res.value._id.toString();

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}

	}

	/**
	 * Inserts data into the database
	 * @param {Model} model Model instance
	 * @param {Object} item item
	 * @returns {String} ID of the object inserted
	 */
	async insert(model, item) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		try {

			const mongoItem = {
				...this.ensureObjectIdsForWrite(model, this.mapIdForMongo(item)),
				dateCreated: new Date()
			};

			const res = await this.makeQuery(model, collection => collection
				.insertOne(mongoItem));

			return res.insertedId.toString();

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Updates data into the database
	 * @param {Model} model Model instance
	 * @param {Object} values values to apply
	 * @param {Object} filter mongodb filter
	 * @returns {Number} modified count
	 */
	async update(model, values, filter) {}

	/**
	 * Multi insert items into the dabatase
	 * @param {Model} model Model instance
	 * @param {Array} items items
	 * @returns {Boolean} true/false
	 */
	async multiInsert(model, items) {}

	/**
	 * Multi insert/update items into the dabatase
	 * @param {Model} model Model instance
	 * @param {Array} items items
	 * @param {Number} limit specifies the limit of items that can be bulk writed into monogdb at the same time
	 * @returns {Boolean} true/false
	 */
	async multiSave(model, items, limit = 1000) {}

	/**
	 * Removes an item from the database
	 * @param {Model} model Model instance
	 * @param {Object} item item
	 * @returns {Boolean} true/false
	 */
	async remove(model, item) {}

	/**
	 * Multi remove items from the database
	 * @param {Model} model Model instance
	 * @param {Object} filter mongodb filter
	 * @returns {Number} deleted count
	 */
	async multiRemove(model, filter) {}

	/**
	 * Get the paginated totals from latest get query.
	 * @param {Model} model Model instance
	 * @returns {Object} total, page size, pages and page from the results.
	 */
	async getTotals(model) {}
}

module.exports = MongoDB;
