'use strict';

const { ObjectID } = require('../mongodb-wrapper');

/**
 * @typedef {import('mongodb').Document} MongoDocument
 */

const ensureObjectId = id => (typeof id === 'string' ? ObjectID(id) : id);

module.exports = class ObjectIdHelper {

	static mapToObjectId(value) {
		return Array.isArray(value) ? value.map(v => ensureObjectId(v)) : ensureObjectId(value);
	}

	static ensureObjectIdsForWrite(model, item) {

		if(Array.isArray(item))
			return item.map(i => this.ensureObjectIdsForWriteForObject(model, i));

		return this.ensureObjectIdsForWriteForObject(model, item);
	}

	static ensureObjectIdsForWriteForObject(model, { id, ...item }) {
		const modelFields = model.constructor.fields || {};

		const parsedItem = {};

		if(id)
			parsedItem._id = this.mapToObjectId(id);

		for(const [field, value] of Object.entries(item))
			parsedItem[field] = modelFields[field] && modelFields[field].isID ? this.mapToObjectId(value) : value;

		return parsedItem;
	}

	/**
	 *
	 * @param {import('mongodb').WithId<MongoDocument>} object
	 * @returns {MongoDocument}
	 */
	static mapIdForClient(object) {

		if(!object._id)
			return object;

		const { _id, ...rest } = object;

		return {
			...rest,
			id: _id.toString()
		};
	}

};
