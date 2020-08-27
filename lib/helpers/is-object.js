'use strict';

module.exports = object => object && typeof object === 'object' && !Array.isArray(object);
