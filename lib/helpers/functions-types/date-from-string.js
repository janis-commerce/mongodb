'use strict';

const FunctionAsFilter = require('./function-as-filter');

class DateFromString extends FunctionAsFilter {

	/**
	 * Transforms dateFromString filter to DateFromString mongo function
	 *
	 * @override
	 * @static
	 * @param {string} fieldKey The field key
	 * @param {object} fieldValue The field value
	 * @returns {object} The processed filter
	 */
	static transform(fieldKey, fieldValue) {

		const dateField = fieldValue.value || fieldKey;
		const format = this._optionalValue('format', fieldValue.format);
		const timezone = this._optionalValue('timezone', fieldValue.timezone);
		return {
			key: fieldKey,
			value: {
				$dateFromString: {
					...format,
					...timezone,
					dateString: `$${dateField}`
				}
			}
		};
	}

	/**
	 * Creates an object for optional filter params
	 *
	 * @override
	 * @static
	 * @param {string} key The filter parameter key
	 * @param {object} fieldValue The filter parameter value
	 * @returns {object}
	 */
	static _optionalValue(key, value) {
		if(!value)
			return {};
		return {
			[key]: value
		};
	}
}

module.exports = DateFromString;
