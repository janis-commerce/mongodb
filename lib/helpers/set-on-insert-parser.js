'use strict';

module.exports = class SetOnInsertParser {

	/**
     * Parse Default values to avoid conflict with Set Data
     * @param {Object} setOnInsert Default Values
     * @param {Object} setData Data to Set
     * @returns {Object} Default Values without Set Data fields
     */
	static parse(setOnInsert, setData) {

		if(!setOnInsert)
			return {};

		const parsedSetOnInsert = {};
		for(const field of Object.keys(setOnInsert)) {
			if(typeof setData[field] === 'undefined')
				parsedSetOnInsert[field] = setOnInsert[field];
		}

		return parsedSetOnInsert;
	}
};
