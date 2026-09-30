'use strict';

const { ObjectId } = require('../mongodb-wrapper');

/**
 * @typedef {import('mongodb').Document} MongoDocument
 */

const ensureObjectId = id => {

	if(typeof id === 'string')
		return new ObjectId(id);

	if(id?.type && id?.value) {
		const newObject = { ...id };
		newObject.value = Array.isArray(id.value) ? id.value.map(v => new ObjectId(v)) : new ObjectId(id.value);
		return newObject;
	}

	return id;
};

const OPERATORS_WITH_IDS = ['$in', '$nin', '$eq', '$ne'];

const isPlainObject = value => !!value && Object.getPrototypeOf(value) === Object.prototype;

const mapOperatorsToObjectId = (value, mapToObjectId) => {

	if(!isPlainObject(value))
		return value;

	const parsed = { ...value };

	for(const operator of OPERATORS_WITH_IDS) {
		if(operator in parsed)
			parsed[operator] = mapToObjectId(parsed[operator]);
	}

	return parsed;
};

class ObjectIdHelper {

	static mapToObjectId(value) {
		return Array.isArray(value) ? value.map(v => ensureObjectId(v)) : ensureObjectId(value);
	}

	static ensureObjectIdsForWrite(model, item) {

		if(typeof item !== 'object' || (Array.isArray(item) && item.length && typeof item[0] === 'string'))
			return item;

		if(Array.isArray(item))
			return item.map(i => this.ensureObjectIdsForWriteForObject(model, i));

		return this.ensureObjectIdsForWriteForObject(model, item);
	}

	static ensureObjectIdsForWriteForObject(model, { id, ...item }) {

		const modelFields = model.constructor.fields || {};

		const parsedItem = {};

		if(id)
			parsedItem._id = model.constructor.hasCustomId ? id : this.mapToObjectId(id);

		for(const [field, value] of Object.entries(item))
			parsedItem[field] = modelFields[field]?.isID ? this.mapToObjectId(value) : value;

		return parsedItem;
	}

	/**
	 * Same as ensureObjectIdsForWrite but also converts the ids inside $in, $nin, $eq and $ne
	 * Intended for $match stages of aggregate
	 *
	 * @param {import('@janiscommerce/model')} model Model instance
	 * @param {object} match The $match stage value
	 * @returns {object}
	 */
	static ensureObjectIdsForMatch(model, match) {

		const parsed = this.ensureObjectIdsForWrite(model, match);

		if(!isPlainObject(match))
			return parsed;

		const modelFields = model.constructor.fields || {};

		const result = { ...parsed };

		if(match.id && !model.constructor.hasCustomId)
			result._id = mapOperatorsToObjectId(result._id, v => this.mapToObjectId(v));

		for(const field of Object.keys(result)) {
			if(field !== '_id' && modelFields[field]?.isID)
				result[field] = mapOperatorsToObjectId(result[field], v => this.mapToObjectId(v));
		}

		return result;
	}

	/**
	 * Maps _id to id only when _id is an ObjectId or a string. Other types are left untouched
	 *
	 * @param {MongoDocument} object
	 * @returns {MongoDocument}
	 */
	static mapAggregateIdForClient(object) {

		if(!(object._id instanceof ObjectId) && typeof object._id !== 'string')
			return object;

		return this.mapIdForClient(object);
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

}

module.exports = ObjectIdHelper;
