'use strict';

const { ObjectID } = require('../mongodb-wrapper');

const ensureObjectId = id => (typeof id === 'string' ? ObjectID(id) : id);

module.exports = class ObjectIdHelper {

	static mapToObjectId(value) {
		return Array.isArray(value) ? value.map(v => ensureObjectId(v)) : ensureObjectId(value);
	}

	static ensureObjectIdsForWrite(model, { id, ...item }) {

		const modelFields = model.constructor.fields || {};

		const parsedItem = {};

		if(id)
			parsedItem._id = this.mapToObjectId(id);

		for(const [field, value] of Object.entries(item))
			parsedItem[field] = modelFields[field] && modelFields[field].isID ? this.mapToObjectId(value) : value;

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
