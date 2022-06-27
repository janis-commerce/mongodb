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

				return {
					...acum,
					[key]: sortOptions[value]
				};
			}, {});

		if(!Object.keys(parsedSortParams).length)
			return;

		// Add id as sort field to ensure sort consistency
		// https://www.mongodb.com/docs/manual/reference/method/cursor.sort/#std-label-sort-cursor-consistent-sorting
		parsedSortParams._id = -1;

		return parsedSortParams;
	}

};
