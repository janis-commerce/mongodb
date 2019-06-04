# MongoDB

[![Build Status](https://travis-ci.org/janis-commerce/mongodb.svg?branch=JCN-50-mongodb)](https://travis-ci.org/janis-commerce/mongodb)
[![Coverage Status](https://coveralls.io/repos/github/janis-commerce/mongodb/badge.svg?branch=JCN-50-mongodb)](https://coveralls.io/github/janis-commerce/mongodb?branch=JCN-50-mongodb)

## Installation
```
npm install --save @janiscommerce/mongodb
```

## API
- `new MongoDB({config})`  
Constructs the MongoDB driver instance, connected with the `config` `[Object]`.  
- **async** `insert(model, item)`  
Inserts data into the mongodb database.  
Requires a `model [Model]` and `item [Object]`.  
Returns `true` if the operation was successfull or `false` if not.  
