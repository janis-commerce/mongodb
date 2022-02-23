
# MongoDB

![Build Status](https://github.com/janis-commerce/mongodb/workflows/Build%20Status/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/janis-commerce/mongodb/badge.svg?branch=master)](https://coveralls.io/github/janis-commerce/mongodb?branch=master)
[![npm version](https://badge.fury.io/js/%40janiscommerce%2Fmongodb.svg)](https://www.npmjs.com/package/@janiscommerce/mongodb)

## Installation

```sh
npm install --save @janiscommerce/mongodb
```

## :new: Changes from _v2.0.0_

### MongoDB Driver v4

Now we are using [mongodb](https://www.npmjs.com/package/mongodb) `^4.3.1` driver (upgraded from v3)

### Events and closing connections

To close connections, it is optional to define the environment variable `CLOSE_MONGODB_CONNECTIONS`.
Connections will be closed according to `CLOSE_MONGODB_CONNECTIONS` environment variable value:

| Value | Close connection | Remarks |
|-------|------------------|---------|
| `undefined` (no value set) | :white_check_mark: | **Default behavior**, if you not set any value or create the env variable. |
| `'false'` or `false` | :x: | :warning: Can be `false` or `'false'` because env variables are saved as string |
| `1`, `'true'`, etc (any value set) | :white_check_mark: | Any other value different from the above. :warning:  We recommend to use `true` or no set any value |

Connection will be closed by emitting a `janiscommerce.ended` event. The event will be emitted in the end of `janiscommerce` functions.

For more information see [@janiscommerce/events](https://www.npmjs.com/package/@janiscommerce/events).

## Models
Whenever the `Model` type is mentioned in this document, it refers to an instance of [@janiscommerce/model](https://www.npmjs.com/package/@janiscommerce/model).

This is used to configure which collection should be used, which unique indexes it has, among other stuff.

## API

### `new MongoDB(config)`

<details>

<summary>Constructs the MongoDB driver instance, connected with the `config` object.</summary>

**Properties:**

- host `String` (optional): MongoDB host, default: `localhost`
- protocol `String` (optional): host protocol, default: `mongodb://`
- port `Number` (optional): host port, default none
- user `String` (optional): host username, default none
- password `String` (optional): host user password, default none
- database `String` **(required)**: MongoDB database
- limit `Number` (optional): Default limit for `get`/`getTotals` operations, default: `500`

**Usage:**
```js
const MongoDB = require('@janiscommerce/mongodb');

const Model = require('./myModel');

const mongo = new MongoDB({
   protocol: 'mongodb://',
   host: 'localhost',
   port: 27017
   user: 'some-user',
   password: 'super-secure-password',
   database: 'great-database'
});

const model = new Model();

// await mongo.[methodName](model);
```

</details>

### ***async*** `insert(model, item)`

<details>
<summary>Inserts one document in a collection</summary>

- model: `Model`: A model instance
- item: `Object`: The item to save in the collection

- Resolves `String`: The *ID* of the inserted item or rejects on failure.

**Usage:**
```js
await mongo.insert(model, {
   id: 1,
   name: 'test'
});
// > '000000054361564751d8516f'
```

</details>

### ***async*** `multiInsert(model, items)`

<details>
<summary>Inserts multiple documents in a collection</summary>

- model: `Model`: A model instance
- item: `Array<Object>`: The items to save in the collection

- Resolves `Array<Object>`: Items inserted
- Rejects `Error` When something bad occurs

**Usage:**
```js
await mongo.multiInsert(model, [
   { id: 2, name: 'test 1' },
   { id: 3, name: 'test 2' },
   { id: 4, name: 'test 3' }
]);
// > true
```

</details>

### ***async*** `update(model, values, filter, options)`

<details>
<summary>Updates one or more documents in a collection</summary>

- model: `Model`: A model instance
- values: `Object`: The values to set in the documents
- filter: `Object`: Filter criteria to match documents
- options: `Object`: Optional parameters (such as [arrayFilters](https://docs.mongodb.com/v3.6/release-notes/3.6/#arrayfilters)) of the query [See more](https://docs.mongodb.com/v3.6/reference/method/db.collection.updateMany/#definition)

- Resolves `Number`: The number of modified documents
- Rejects `Error` When something bad occurs

**Usage:**
```js
// Updating an item
await mongo.update(
   model,
   { name: 'foobar', color: 'red' }, // the values to update
   { id: 1 } // the filter
);
// > 1

// Updating the enire collection...
await mongo.update(
   model,
   { status: 'active' }, // the values to update
);
// > Number

// Updating certain elements of an array
/* Sample document to match
{
	_id: ObjectID('5df0151dbc1d570011949d86'),
	items: [{ name: 'foo', price: 90 },{ name: 'bar', price: 45 }]
}
*/
await mongo.update(
   model,
   { $set: { "items.$[elem].price" : 100 } }, // the values to update
   {}
   { arrayFilters: [ { "elem.price": { $gte: 85 } } ] }
)
// > Number
/* Output
{
	_id: ObjectID('5df0151dbc1d570011949d86'),
	items: [{ name: 'foo', price: 100 },{ name: 'bar', price: 45 }]
}
*/
```

</details>

### ***async*** `distinct(model, [parameters])`

<details>
<summary>Searches distinct values of a property in a collection</summary>

- model: `Model`: A model instance
- parameters: `Object` (optional): The query parameters. Default: `{}`. It only accepts `key` (the field name to get distinct values from, and `filters` -- described below in `get()` method)

- Resolves `Array<Object>`: An array of documents
- Rejects `Error` When something bad occurs

**Usage:**
```js
await mongo.distinct(model, { key: 'color', filters: { status: 'active' } });
// > ['Red', 'Blue']

```

</details>

### ***async*** `get(model, [parameters])`

<details>
<summary>Searches documents in a collection</summary>

- model: `Model`: A model instance
- parameters: `Object` (optional): The query parameters. Default: `{}`

- Resolves `Array<Object>`: An array of documents
- Rejects `Error` When something bad occurs

**Available parameters: (all of them are optional)**

- order `Object`: Sets the sorting criteria of the matched documents, for example: `{ myField: 'asc', myOtherField: 'desc' }`
- limit `Number`: Sets the page size when fetching documents. Defaults to the limit of the constructor.
- page `Number`: Sets the current page to retrieve.
- filters `Object|Array<Object>`: Sets the criteria to match documents. An object means AND operation between multiple filters. An array mean an OR operation. See examples [below](#filters).

Parameters example:
```js
{
   limit: 1000, // Default 500 from config
   page: 2,
   order: {
      itemField: 'asc'
   },
   filters: {
      itemField: 'foobar',
      otherItemField: {
         'value': ['foo', 'bar'],
         'type' : 'in'
      }
   }
}
```

#### Filters

The filters have a simpler structure than raw mongo filters, in order to simplify it's usage.

**Filter types**

The filter types can be defined in the model static getter `fields` like this:
```js
class MyModel extends Model {
	static get fields() {
		return {
			myField: {
				type: 'greaterOrEqual'
			}
		}
	}
}
```

It can also be overriden in each query like this:
```js
mongodb.get(myModel, {
	filters: {
		myField: {
			type: 'lesserOrEqual',
			value: 10
		}
	}
});
```

The following table shows all the supported filter types, and it's equivalence:

| Type           | Mongo equivalence |
| -------------- | ----------------- |
| equal          | $eq               |
| notEqual       | $ne               |
| greater        | $gt               |
| greaterOrEqual | $gte              |
| lesser         | $lt               |
| lesserOrEqual  | $lte              |
| in             | $in               |
| notIn          | $nin              |
| search         | $regex            |
| all            | $all              |
| exists         | $exists           |
| text           | $text             |
| elemMatch      | $elemMatch        |
| nearSphere     | $nearSphere       |
| geoIntersects  | $geoIntersects    |

If the type isn't defined in the model nor in the query, it defaults to `equal` for single valued filters or `in` for multivalued filter.

You can also pass an _unsupported_ mongodb `type` (it must start with the `$` character, for example: `$mod`).

**Internal field names**

The name of a filter and the field that it will match can differ. To achieve that, you must declare it in the model static getter `fields`:

```js
class MyModel extends Model {
	static get fields() {
		return {
			externalFieldName: {
				field: 'internalFieldName'
			}
		}
	}
}
```

**Mongo ObjectIds**

The fields of type `ObjectId` can be defined in the model this way:
```js
class MyModel extends Model {
	static get fields() {
		return {
			someIdField: {
				isID: true
			}
		}
	}
}
```

The package will handle the `string` to `ObjectId` conversion automatically for you. The `id` field is also automatically mapped to `_id` and converted to an `ObjectId`

It also maps `_id` field to `id` when retrieving documents.

**Example**

Putting it all together, here's a complete example with all possible configurations:

```js

class MyModel extends Model {
	static get fields() {
		return {
			otherIdField: {
				isID: true
			},
			greaterField: {
				type: 'greaterOrEqual'
			},
			overridenField: {
				type: 'search'
			},
			externalFieldName: {
				field: 'internalFieldName'
			}
		}
	}
}

mongodb.get(myModel, {
	filters: {
		id: '5df0151dbc1d570011949d86',
		otherIdField: ['5df0151dbc1d570011949d87', '5df0151dbc1d570011949d88'],
		greaterField: 15,
		overridenField: {
			type: 'exists',
			value: true
		},
		externalFieldName: true,
		someOtherField: ['foo', 'bar']
	}
});

// This is converted to the following mongo filter:
{
	id: {
		$eq: ObjectId('5df0151dbc1d570011949d86') // Automatically converted to ObjectId, default $eq type
	},
	otherIdField: {
		$in: [ObjectId('5df0151dbc1d570011949d87'), ObjectId('5df0151dbc1d570011949d88')] // Converted to ObjectId by model, default $in type
	},
	greaterField: {
		$gte: 15 // $gte type defined by model
	},
	overridenField: {
		$exists: true // $exists type overriden by query
	},
	internalFieldName: {
		$eq: true // Field name defined by model, default $eq type
	},
	someOtherField: {
		$in: ['foo', 'bar'] // Default $in type
	}
}
```

#### Nested filters
If you want to filter by fields inside objects, you can use nested filters. For example:
```js
{

/* Sample document to match
{
	_id: ObjectID('5df0151dbc1d570011949d86'),
	someField: {
		foo: 'bar'
	}
}
*/
mongodb.get(myModel, {
	filters: {
		'someField.foo': 'bar'
	}
});
```

**Usage:**
```js
await mongo.get(model, {})
// > [ ... ] // Every document in the collection, up to 500 documents.

// finding documents with a specific filter
await mongo.get(model, { filters: { id: 1 } })
// > [{ id: 1, name: 'foobar' }]

// finding the page 2 of elements with value "foo" with a page size of 10 elements.
await mongo.get(model, { limit: 10, page: 2 filters: { name: 'foo' } })
// > [ ... ] // The second page of 10 documents matching name equals to 'foo'.

// finding all entries ordered descendently by id
await mongo.get(model, { order: { id: 'desc' } });
// > [ ... ] // Every document in the collection, ordered by descending id, up to 500 documents.
```

</details>

### ***async*** `getTotals(model)`

<details>
<summary>Gets information about the quantity of documents matched by the last call to the `get()` method.</summary>

- model: `Model`: A model instance used for the query. **IMPORTANT**: This must be the same instance.

- Resolves `Object`: An object containing the totalizers
- Rejects `Error` When something bad occurs

Return example:
```js
{
   total: 140,
   pageSize: 60,
   pages: 3,
   page: 1
}
```

If no query was executed before, it will just return the `total` and `pages` properties with a value of zero.

**Usage:**
```js
// getTotals
result = await mongo.getTotals(model);
// > { page: 1, limit: 500, pages: 1, total: 4 }
```

</details>

### ***async*** `save(model, item, setOnInsert)`

<details>
<summary>Inserts or updates a document in a collection.</summary>

- model: `Model`: A model instance used for the query.
- item: `Object`: The item to upsert in the collection
- setOnInsert: `Object`: Default values to insert on Items.

- Resolves `Object`: An object containing the totalizers
- Rejects `Error` When something bad occurs

This operation uses unique indexes in order to update existing documents. If `id` is provided in the item, it will be used. Otherwise, it will try to match a unique index defined in the model. If no unique index can be matched by the item, it will reject an error.

**Usage:**
```js
// save insert
await mongo.save(model, {
   unique: 1,
   name: 'test'
});
// > '000000054361564751d8516f'

// save update
await mongo.save(model, {
   id: '00000058faf66849077316ba',
   unique: 1,
   name: 'test'
});
// > '00000058faf66849077316ba'

// save update
await mongo.save(model, {
   unique: 2,
   name: 'test-2'
}, { status: 'active' });
// > '00000058faf66849077316bb'
/* In DB:
{
   _id: '00000058faf66849077316bb',
   unique: 2,
   name: 'test-2',
   dateCreated: ISODate("2020-01-14T14:01:29.170Z"),
   status: 'active'
}
*/

// save update
await mongo.save(model, {
   unique: 2,
   name: 'test-2',
   status: 'inactive'
}, { status: 'active' });
// > '00000058faf66849077316bb'
/* In DB:
{
   _id: '00000058faf66849077316bb',
   unique: 2,
   name: 'test-2',
   dateCreated: ISODate("2020-01-14T14:01:29.170Z"),
   status: 'inactive'
}
*/
```
</details>

### ***async*** `multiSave(model, items, setOnInsert)`

<details>
<summary>Inserts or updates a document in a collection.</summary>

- model: `Model`: A model instance used for the query.
- items: `Array<Object>`: The items to upsert in the collection
- setOnInsert: `Object`: Default values to insert on Items.

- Resolves `Boolean`: `true` if items can be upserted
- Rejects `Error` When something bad occurs

**Usage:**
```js
await mongo.multiSave(model, [
   { id: 1, name: 'test 1' },
   { id: 2, name: 'test 2' },
   { id: 3, name: 'test 3' }
]);
// > true
```

</details>

### ***async*** `remove(model, item)`

<details>
<summary>Inserts or updates a document in a collection.</summary>

- model: `Model`: A model instance used for the query.
- item: `Object`: The items to be removed

- Resolves `Boolean`: `true` if one document was removed. `false` otherwise.
- Rejects `Error` When something bad occurs

This operation uses unique indexes in order to remove an existing document. If `id` is provided in the item, it will be used. Otherwise, it will try to match a unique index defined in the model. If no unique index can be matched by the item, it will reject an error.

**Usage:**
```js
await mongo.remove(model, { id: '0000000055f2255a1a8e0c54' });
// > true|false
```

</details>

### ***async*** `multiRemove(model, filter)`

<details>
<summary>Removes one or more documents in a collection.</summary>

- model: `Model`: A model instance
- filter: `Object`: Filter criteria to match documents

- Resolves `Number`: Number that repesents the amount of removed documents.
- Rejects `Error` When something bad occurs

**Usage:**
```js
await mongo.multiRemove(model, { name: { type: 'search', value: 'test' } });
// > 5
```

</details>

### ***async*** `increment(model, filters, incrementData, setData)`

<details>
<summary>Increment or decrement values in a registry.</summary>

- model: `Model`: A model instance used for the query.
- filters: `Object`: Unique Filter criteria to match documents
- incrementData: `Object`: The fields with the values to increment or decrement to updated in the collection (values must be *number* type).
- setData: `Object`: extra data to be updated in the registry

- Resolves `Object`: An object containing the updated registry
- Rejects `Error` When something bad occurs

**Usage:**
```js
await mongo.increment(model, { status: 'pending' }, { pendingDaysQuantity: 1 }, { updatedDate: new Date() });
/* Output:
{
   _id: ObjectID('5df0151dbc1d570011949d86'),
   status: 'pending',
   pendingDaysQuantity: 4
   updatedDate:ISODate("2020-11-09T14:01:29.170Z")
}
*/
```

</details>

### ***async*** `getIndexes(model)`

<details>
<summary>Get the indexes from the collection.</summary>

- model `Model`: A model instance

- Resolves `Array<object>`: An array with the collection indexes
- Rejects `Error`: When something bad occurs

This method also format the received indexes from MongoDB by getting only the fields `name`, `key` and `unique`.

**Usage:**
```js
await mongo.getIndexes(model);
// > [{name: 'some-index', key: { field: 1 }, unique: false}]
```

</details>

### ***async*** `createIndex(model, index)`

<details>
<summary>Creates an index into the collection.</summary>

- model `Model`: A model instance
- index `Object`: An object with the following properties:
   - name `String` (Required): The index name
   - key `Object` (Required): The index key with the fields to index
   - unique `Boolean` (Optional): Indicates if the index must be unique or not

- Resolves `Boolean`: `true` if the index was successfully created
- Rejects `Error`: When something bad occurs

**Usage:**
```js
await mongo.createIndex(model, {
   name: 'some-index',
   key: { field: 1 },
   unique: true
});
// > true
```

</details>

### ***async*** `createIndexes(model, indexes)`

<details>
<summary>Creates multiple indexes into the collection.</summary>

- model `Model`: A model instance
- indexes `Array<object>`: An array with the indexes to create (index object structure defined in `createIndex` method)

- Resolves `Boolean`: `true` if the indexes was successfully created
- Rejects `Error`: When something bad occurs

**Usage:**
```js
await mongo.createIndexes(model, [
   {
      name: 'some-index',
      key: { field: 1 },
      unique: true
   },
   {
      name: 'other-index',
      key: { otherField: 1 }
   }
]);
// > true
```

</details>

### ***async*** `dropIndex(model, indexName)`

<details>
<summary>Drops an index from the collection.</summary>

- model `Model`: A model instance
- indexName: `String`: The name of the index to drop

- Resolves `Boolean`: `true` if the index was successfully dropped
- Rejects `Error`: When something bad occurs

**Usage:**
```js
await mongo.dropIndex(model, 'some-index');
// > true
```

</details>

### ***async*** `dropIndexes(model, indexNames)`

<details>
<summary>Drops multiple indexes from the collection.</summary>

- model `Model`: A model instance
- indexNames: `Array<string>`: The names of the indexs to drop

- Resolves `Boolean`: `true` if the index was successfully dropped
- Rejects `Error`: When something bad occurs

**Usage:**
```js
await mongo.dropIndexes(model, ['some-index', 'other-index'])
// > true
```

</details>

### ***async*** `dropDatabase()`

<details>
<summary>Drops the database for the current config.</summary>

- Resolves `Boolean`: `true` if the database was successfully dropped, false otherwise.
- Rejects `Error`: When something bad occurs

**Usage:**
```js
await mongo.dropDatabase();
// > true|false
```

</details>

## Errors

The errors are informed with a `MongoDBError`.
This object has a code that can be useful for a debugging or error handling.
The codes are the following:

| Code | Description                        |
|------|----------------------------------- |
| 1    | Model with empty unique indexes    |
| 2    | No unique indexes could be matched |
| 3    | Invalid or empty model             |
| 4    | Internal mongodb error             |
| 5    | Invalid connection config          |
| 6    | Invalid item format received       |
| 7    | Invalid distinct key received      |
| 8    | Filter type not recognized         |
| 9    | Invalid Increment Data             |
| 10   | Invalid index structure            |