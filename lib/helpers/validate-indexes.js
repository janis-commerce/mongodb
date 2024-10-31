'use strict';

const Validator = require('fastest-validator');
const MongoDBError = require('../mongodb-error');

const v = new Validator();

const indexSchema = {
	$$root: true, // Indica que el root es un array de objetos
	type: 'array',
	items: {
		type: 'object',
		props: {
			name: { type: 'string' },
			key: { type: 'object' },
			unique: { type: 'boolean', optional: true },
			expireAfterSeconds: { type: 'number', optional: true },
			partialFilterExpression: { type: 'object', optional: true },
			sparse: { type: 'boolean', optional: true }
		}
	}
};

module.exports = indexes => {
	const validationResult = v.validate(indexes, indexSchema);

	if(validationResult !== true) {
		const errorMessages = validationResult.map(err => `${err.field}: ${err.message}`).join(', ');
		throw new MongoDBError(`Invalid index: ${errorMessages}`, MongoDBError.codes.INVALID_INDEX);
	}
};
