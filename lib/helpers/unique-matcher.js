'use strict';

const MongoDBError = require('../mongodb-error');

module.exports = class UniqueMatcher {

	static getUniqueValueForItem(model, item) {

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

};
