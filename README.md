# MongoDB

[![Build Status](https://travis-ci.org/janis-commerce/mongodb.svg?branch=JCN-50-mongodb)](https://travis-ci.org/janis-commerce/mongodb)
[![Coverage Status](https://coveralls.io/repos/github/janis-commerce/mongodb/badge.svg?branch=JCN-50-mongodb)](https://coveralls.io/github/janis-commerce/mongodb?branch=JCN-50-mongodb)

## Installation

```sh
npm install --save @janiscommerce/mongodb
```

## API

- `new MongoDB({config})`  
Constructs the MongoDB driver instance, connected with the `config` `[Object]`.  

- *async* `insert(model, {item})`  
Inserts data into the mongodb database.  
Requires a `model [Model]` and `item [Object]`.  
Returns `true` if the operation was successfull or `false` if not.  

- *async* `multiInsert(model, [{items}])`  
Inserts multiple elements into the mongodb database.  
Requires a `model [Model]` and `item [Object array]`.  
Returns `true` if the operation was successfull or `false` if not.  

- *async* `update(model, {values}, {filter})`  
Updates an existing element from the database.  
Requires a `model [Model]`, `values [Object]` and `filter [Object]`  
Returns the modified/updated elements count.  

- *async* `get(model, {parameters})`  
Search elements from the database then returns an `[Array]` with the results `[Object]`.
Requires a `model [Model]`, `parameters [Object]` are optional.  

- *async* `save(model, {item})`  
Apply the changes into the specified item from the database, then updates the last modified information.  
Requires a `model [Model]` and `item [Object]`.  
Returns `true/false` if the result was successfully or not.  

- *async* `multiSave(model, [{items}])`  
Apply the changes into multiple specified items from the database, then updates the last modified information.  
Requires a `model [Model]` and `item [Object array]`.  
Returns `true/false` if the result was successfully or not.  

## Errors

The errors are informed with a `MongoDBError`.  
This object has a code that can be useful for a correct error handling.  
The codes are the following:  

| Code | Description                   |
|------|-------------------------------|
| 1    | Model with empty indexes      |
| 2    | Empty indexes                 |

## Usage

```js
const MongoDB = require('@janiscommerce/mongodb');
const Model = require('myModel');

const mongo = new MongoDB({
   host: 'mongodb://foo:3306/foobar',
   user: 'sarasa',
   db: 'myDB'
});

const model = new Model();

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
   result = await mongo.get(model, { id: 1 }) // expected return: row with _id == 1

   // save
   result = await mongo.save(model, {
      _id: 1,
      value: 'sarasa'
   }); // expected return: true

   //multiSave
   result = await mongo.multiSave(model, [
      { _id: 1, value: 'sarasa 1' },
      { _id: 2, value: 'sarasa 2' },
      { _id: 3, value: 'sarasa 3' }
   ]); // expected return: true

});
```
