'use strict';

module.exports = dateCreated => {

	if(typeof dateCreated === 'string') {

		// date received as iso date

		dateCreated = new Date(dateCreated);

		return Number.isNaN(dateCreated.getDate())
			? new Date() // e.g. invalid date received as string
			: dateCreated;
	}

	return dateCreated instanceof Date
		? dateCreated // valid date received
		: new Date(); // e.g. undefined received or other invalid values
};
