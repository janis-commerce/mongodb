'use strict';

class FunctionAsFilter {

	/**
	 * Validates and parse filter to mongo function
	 *
	 * @static
	 * @param {string} fieldKey The field key
	 * @param {object} fieldValue The field value
	 * @returns {object} The processed filter
	 */
	static parse(fieldKey, fieldValue) {
		this.validate(fieldKey, fieldValue);
		return this.transform(fieldKey, fieldValue);
	}

	/**
	 * Transforms filter to mongo function
	 *
	 * @static
	 * @param {string} fieldKey The field key
	 * @param {object} fieldValue The field value
	 * @returns {object} The processed filter
	 */
	static transform(fieldKey, fieldValue) {
		return {
			key: fieldKey,
			value: fieldValue
		};
	}

	/**
	 * Validates field value
	 *
	 * @static
	 * @param {string} fieldKey The field key
	 * @param {object} fieldValue The field value
	 */
	static validate(fieldKey, fieldValue) {
		if(!fieldValue)
			throw new Error(`${fieldKey} has not a valid value`);
	}
}

module.exports = FunctionAsFilter;
