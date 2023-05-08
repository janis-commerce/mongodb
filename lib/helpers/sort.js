'use strict';

module.exports = class MongoDBSort {

	static parseSortingParams(order) {

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

				if(key === 'id')
					key = '_id';

				return {
					...acum,
					[key]: sortOptions[value]
				};
			}, {});

		if(!Object.keys(parsedSortParams).length)
			return;

		return parsedSortParams;
	}

};
