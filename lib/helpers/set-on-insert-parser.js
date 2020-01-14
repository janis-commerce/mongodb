'use strict';

class SetOnInsertParser {

	/**
     * Parse Default values to avoid conflict with Set Data
     * @param {Object} setOnInsert Default Values
     * @param {Object} setData Data to Set
     * @returns {Object} Default Values without Set Data fields
     */
	static parse(setOnInsert, setData) {

		if(!setOnInsert)
			return {};

		return Object.entries(setOnInsert)
			.reduce((acum, [field, value]) => {
				if(typeof setData[field] === 'undefined')
					acum = { ...acum, [field]: value };
				return acum;
			}, {});
	}
}

module.exports = SetOnInsertParser;
