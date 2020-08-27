'use strict';

const MongoDBError = require('../mongodb-error');
const isObject = require('./is-object');

module.exports = class UniqueMatcher {

	static getUniqueValueForItem(model, item) {

		if(item._id)
			return { _id: item._id };

		const uniqueIndexes = this.getModelIndexes(model);

		if(!uniqueIndexes || !uniqueIndexes.length) {
			throw new MongoDBError(`Model requires unique indexes. See ${model.constructor.name}.indexes`,
				MongoDBError.codes.MODEL_EMPTY_UNIQUE_INDEXES);
		}

		for(let index of uniqueIndexes) {

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

		throw new MongoDBError(`No unique indexes could be matched. See ${model.constructor.name}.indexes`, MongoDBError.codes.EMPTY_UNIQUE_INDEXES);
	}

	static getModelIndexes(model) {

		if(model.constructor.indexes)
			return this.prepareUniqueIndexes(model.constructor.indexes);

		return model.constructor.uniqueIndexes;
	}

	static prepareUniqueIndexes(indexes) {
		return indexes
			.filter(index => isObject(index) && !!index.unique && isObject(index.key))
			.map(index => Object.keys(index.key));
	}

};
