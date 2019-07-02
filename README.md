# MongoDB

[![Build Status](https://travis-ci.org/janis-commerce/mongodb.svg?branch=JCN-50-mongodb)](https://travis-ci.org/janis-commerce/mongodb)
[![Coverage Status](https://coveralls.io/repos/github/janis-commerce/mongodb/badge.svg?branch=JCN-50-mongodb)](https://coveralls.io/github/janis-commerce/mongodb?branch=JCN-50-mongodb)

## Installation

```sh
npm install --save @janiscommerce/mongodb
```

## API

- `new MongoDB({config})`  
Constructs the MongoDB driver instance, connected with the `config [Object]`. 

Config usage:
```js
{
   host: 'mongodb://localhost',
   port: 27017, // Default 27017
   limit: 500, // Default 500
   database: 'myDB'
}
```

- *async* `createIndexes(model)`
Creates indexes and unique indexes from the model to the MongoDB database.  
Requires a `model [Model]`  

- *async* `insert(model, {item})`  
Insert a item into the database.  
Requires a `model [Model]` and `item [Object]`.  
Returns `true` if the operation was successfull or `false` if not.  

- *async* `multiInsert(model, [{items}])`  
Inserts multiple items into the database.  
Requires a `model [Model]` and `item [Object array]`.  
Returns `true` if the operation was successfull or `false` if not.  

- *async* `update(model, {values}, {filter})`  
Updates one or multiple items from the database.  
Requires a `model [Model]`, `values [Object]` and `filter [Object]` (MongoDB filter).  
Returns the modified/updated elements count.  

- *async* `get(model, {parameters})`  
Search elements from the database then returns an `[Array]` with the results `[Object]`.
Requires a `model [Model]`, `parameters [Object]` are optional. 

Parameters (all are optional):
- limit: Max amount of items per page to get. Default: 500 or setted on config when constructs.
- page: Items of the specified page
- filters: MongoDB filters, leave empty for all items.

Parameters example:
```js
{
   limit: 1000, // Default 500 from config
   page: 2,
   filters: {
      itemField: 'foobar',
      otherItemField: {
         $in: ['foo', 'bar']
      },
   }
}
```

- *async* `getTotals(model)`  
Get the totals of the items from the latest get operation with pagination.
Requires a `model [Model]`
Returns an `[Object]` with the total count, page size, pages and selected page.  

getTotals return example:
```js
{
   total: 1000,
   pageSize: 1000, // Limit from latest get operation or 500 by default
   pages: 2,
   page: 1
}
```

- *async* `save(model, {item})`  
Insert/update a item into the database.  
Requires a `model [Model]` and `item [Object]`.  
Returns `true/false` if the result was successfully or not.  

- *async* `multiSave(model, [{items}], limit)`  
Insert/update multiple items into the database.
Requires a `model [Model]` and `items [Object array]`.  
`limit [Number]` (optional, default 1000): Specifies the max amount of items that can be written at same time.  
Returns `true/false` if the result was successfully or not.  

- *async* `remove(model, {item})`  
Removes the specified item from the database.
Requires a `model [Model]` and `item [Object]`.  
Returns `true/false` if the result was successfully or not.  

- *async* `multiRemove(model, {filter})`  
Removes multiple items from the database.  
Requires a `model [Model]` and `filter [Object]` (MongoDB filter).  
Returns `deletedCount [Number]`.  

## Errors

The errors are informed with a `MongoDBError`.  
This object has a code that can be useful for a correct error handling.  
The codes are the following:  

| Code | Description                   |
|------|-------------------------------|
| 1    | Model with empty indexes      |
| 2    | Empty indexes                 |
| 3    | Invalid or empty model        |
| 4    | Internal mongodb error        |
| 5    | Invalid config                |

## Usage

```js
const MongoDB = require('@janiscommerce/mongodb');
const Model = require('myModel');

const mongo = new MongoDB({
   host: 'mongodb://foo',
   port: 27017
   user: 'sarasa',
   database: 'myDB'
});

const model = new Model();

mongo.createIndexes(model);

(async function() {

   let result;

   // Insert
   result = await mongo.insert(model, {
      _id: 1,
      value: 'sarasa'
   }); // expected return: true

   // multiInsert
   result = await mongo.multiInsert(model, [
      { _id: 1, value: 'sarasa 1' },
      { _id: 2, value: 'sarasa 2' },
      { _id: 3, value: 'sarasa 3' }
   ]); // expected return: true

   // update
   result = await mongo.update(model,
      { value: 'foobar' },
      { _id: 1 }
   ); // expected return: 1 (row with _id == 1 will change his "value" from "sarasa" to "foobar")

   // get
   result = await mongo.get(model, {}) // expected return: all entries
   result = await mongo.get(model, { filters: { _id: 1 } }) // expected return: row with _id == 1
   result = await mongo.get(model, { limit: 10, page: 2 filters: { value: 'foo' } }) // expected return: page 2 of elements with value "foo" with a page size of 10 elements.

   // getTotals
   result = await mongo.getTotals(model);

   /* Example return
      {
         page: 2,
         limit: 10,
         pages: 5,
         total: 50
      }
   */

   // save
   result = await mongo.save(model, {
      _id: 1,
      value: 'sarasa'
   }); // expected return: true

   // multiSave
   result = await mongo.multiSave(model, [
      { _id: 1, value: 'sarasa 1' },
      { _id: 2, value: 'sarasa 2' },
      { _id: 3, value: 'sarasa 3' }
   ]); // expected return: true

   // remove
   result = await mongo.remove(model, { id: 1 }); // expected return: true

   // multiRemove
   result = await mongo.multiRemove(model, { value: /sarasa/ });
   // expected return: 3 (should delete all items that contains "sarasa" on "value" field).
});
```
