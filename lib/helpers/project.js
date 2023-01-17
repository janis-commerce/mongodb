'use strict';

module.exports = class MongoDBProject {

	static parse({ fields, excludeFields }) {

		if(fields?.length)
			return fields.reduce((project, field) => ({ ...project, [field]: true }), {});

		if(excludeFields?.length)
			return excludeFields.reduce((project, field) => ({ ...project, [field]: false }), {});
	}
};
