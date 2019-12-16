'use strict';

const { ObjectID } = require('../mongodb-wrapper');

const ensureObjectId = id => (typeof id === 'string' ? ObjectID(id) : id);

module.exports = class ObjectIdHelper {

	static mapIdForMongo(object) {

		if(!object.id)
			return object;

		const { id, ...rest } = object;

		return {
			...rest,
			_id: ensureObjectId(id)
		};
	}

	// static mapToObjectId(value) {
	// 	return Array.isArray(value) ? value.map(v => ensureObjectId(v)) : ensureObjectId(value);
	// }

	static ensureObjectIdsForWrite(model, item) {

		if(!model.constructor.fields || !Object.keys(model.constructor.fields).length)
			return item;

		const modelFields = model.constructor.fields;

		const parsedItem = {};

		for(const [field, value] of Object.entries(item))
			parsedItem[field] = modelFields[field] && modelFields[field].isID ? ensureObjectId(value) : value;

		return parsedItem;
	}

	// static mapIdForClient(object) {

	// 	if(!object._id)
	// 		return object;

	// 	const { _id, ...rest } = object;

	// 	return {
	// 		...rest,
	// 		id: Array.isArray(_id) ? _id.map(String) : String(_id)
	// 	};
	// }

};
