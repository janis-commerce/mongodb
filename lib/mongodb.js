'use strict';

const { inspect } = require('util');

const { MongoWrapper: Mongo } = require('./mongodb-wrapper');

const MongoDBError = require('./mongodb-error');

const MongoDBFilters = require('./mongodb-filters');

const ObjectIdHelper = require('./helpers/object-id');
const MongoDBSort = require('./helpers/sort');
const UniqueMatcher = require('./helpers/unique-matcher');

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

		this.mongo = new Mongo(this.config);
	}

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

			const res = await this.mongo.makeQuery(model, collection => collection.distinct(key, filters));

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
		const order = MongoDBSort.parseSortingParams(params.order);
		const filters = MongoDBFilters.parseFilters(ObjectIdHelper.ensureObjectIdsForWrite(model, params.filters || {}), model);

		try {

			const res = await this.mongo.makeQuery(model, collection => collection
				.find(filters)
				.sort(order)
				.skip((limit * page) - limit)
				.limit(limit)
				.toArray());

			model.lastQueryHasResults = !!res.length;
			model.totalsParams = {
				limit,
				page,
				filters,
				order
			};

			return res.map(item => ObjectIdHelper.mapIdForClient(item));

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Insert/update one element into the database
	 * @param {Model} model Model instance
	 * @param {Object} item item
	 * @returns {String} ID
	 */
	async save(model, item) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const mongoItem = ObjectIdHelper.ensureObjectIdsForWrite(model, item);

		const filters = MongoDBFilters.parseFilters(UniqueMatcher.getUniqueValueForItem(model, mongoItem), model);

		try {

			const { _id, dateCreated, dateModified, ...setData } = mongoItem; // Remove to prevent upsert errors

			const res = await this.mongo.makeQuery(model, collection => collection
				.findAndModify(filters, {}, {
					$set: setData,
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
				...ObjectIdHelper.ensureObjectIdsForWrite(model, item),
				dateCreated: new Date()
			};

			const res = await this.mongo.makeQuery(model, collection => collection
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
	 * @param {Object} filters mongodb filters
	 * @returns {Number} modified count
	 */
	async update(model, values, filters) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		try {

			const mongoItem = {
				...ObjectIdHelper.ensureObjectIdsForWrite(model, values),
				dateModified: new Date()
			};

			const updateData = {
				$set: mongoItem
			};

			const res = await this.mongo.makeQuery(model, collection => collection
				.updateMany(MongoDBFilters.parseFilters(ObjectIdHelper.ensureObjectIdsForWrite(model, filters || {}), model), updateData));

			return res.modifiedCount;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Multi insert items into the dabatase
	 * @param {Model} model Model instance
	 * @param {Array} items items
	 * @returns {Boolean} true/false
	 */
	async multiInsert(model, items) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		if(!Array.isArray(items))
			throw new MongoDBError('Items must be an Array', MongoDBError.codes.INVALID_ITEM);

		if(!items.length)
			throw new MongoDBError('Items must not be empty', MongoDBError.codes.INVALID_ITEM);

		try {

			const mongoItems = items.map(item => ({
				...ObjectIdHelper.ensureObjectIdsForWrite(model, item),
				dateCreated: new Date()
			}));

			const res = await this.mongo.makeQuery(model, collection => collection
				.insertMany(mongoItems));

			return !!res.result.ok;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}

	/**
	 * Multi insert/update items into the dabatase
	 * @param {Model} model Model instance
	 * @param {Array} items items
	 * @param {Number} limit specifies the limit of items that can be bulk writed into monogdb at the same time
	 * @returns {Boolean} true/false
	 */
	async multiSave(model, items) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		if(!Array.isArray(items))
			throw new MongoDBError('Items must be an Array', MongoDBError.codes.INVALID_ITEM);

		if(!items.length)
			throw new MongoDBError('Items must not be empty', MongoDBError.codes.INVALID_ITEM);

		const bulkItems = items.map(item => {

			const mongoItem = ObjectIdHelper.ensureObjectIdsForWrite(model, item);

			const filters = MongoDBFilters.parseFilters(UniqueMatcher.getUniqueValueForItem(model, mongoItem), model);

			const { _id, dateCreated, dateModified, ...setData } = mongoItem; // Remove to prevent upsert errors

			const updateData = {
				$set: setData,
				$currentDate: { dateModified: true },
				$setOnInsert: { dateCreated: new Date() }
			};

			return { updateOne: { filter: filters, update: updateData, upsert: true } };
		});

		try {

			await this.mongo.makeQuery(model, collection => collection
				.bulkWrite(bulkItems));

			return true;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}

	}

	/**
	 * Removes an item from the database
	 * @param {Model} model Model instance
	 * @param {Object} item item
	 * @returns {Boolean} true/false
	 */
	async remove(model, item) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const mongoItem = ObjectIdHelper.ensureObjectIdsForWrite(model, item);

		const filters = MongoDBFilters.parseFilters(UniqueMatcher.getUniqueValueForItem(model, mongoItem), model);

		try {

			const res = await this.mongo.makeQuery(model, collection => collection
				.deleteOne(filters));

			return res.deletedCount === 1;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}

	}

	/**
	 * Multi remove items from the database
	 * @param {Model} model Model instance
	 * @param {Object} filter mongodb filter
	 * @returns {Number} deleted count
	 */
	async multiRemove(model, filter) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const mongoItem = ObjectIdHelper.ensureObjectIdsForWrite(model, filter);

		const filters = MongoDBFilters.parseFilters(mongoItem, model);

		try {

			const res = await this.mongo.makeQuery(model, collection => collection
				.deleteMany(filters));

			return res.deletedCount;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}

	}

	/**
	 * Get the paginated totals from latest get query.
	 * @param {Model} model Model instance
	 * @returns {Object} total, page size, pages and page from the results.
	 */
	async getTotals(model) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		if(!model.lastQueryHasResults)
			return { total: 0, pages: 0 };

		const { filters, limit, page } = model.totalsParams;

		try {

			const count = await this.mongo.makeQuery(model, collection => collection
				.countDocuments(filters));

			const result = {
				total: count,
				pageSize: limit,
				pages: Math.ceil(count / limit),
				page
			};

			return result;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}

	}

	/**
	 * Increment values in registry
	 * @param {Model} model Model instance
	 * @param {Object} filters unique filters
	 * @param {Object} incrementData Values to Increment
	 * @param {Object} setData Data to Add
	 * @returns {Object} Registry updated
	 */
	async increment(model, filter, incrementData, setData) {

		if(!model)
			throw new MongoDBError('Invalid or empty model', MongoDBError.codes.INVALID_MODEL);

		const mongoItem = ObjectIdHelper.ensureObjectIdsForWrite(model, filter);

		const filters = MongoDBFilters.parseFilters(UniqueMatcher.getUniqueValueForItem(model, mongoItem), model);

		const increments = ConfigValidator.validateIncrementData(incrementData);

		try {

			const res = await this.mongo.makeQuery(model, collection => collection
				.findAndModify(filters, {}, {
					$set: setData,
					$inc: increments,
					$currentDate: { dateModified: true }
				}, { upsert: false, new: true })); // 'new: true' return the object updated

			return res.value;

		} catch(err) {
			throw new MongoDBError(err, MongoDBError.codes.MONGODB_INTERNAL_ERROR);
		}
	}
}

module.exports = MongoDB;
