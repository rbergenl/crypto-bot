Open a new terminal:
- `nvm use 8.9.1` (to support async/await)
- `$ node bittrexBuyer --local --dryRun`
- `$ node bittrexCronjob`
- `$ npm start `

Package used:
https://www.npmjs.com/package/ccxt
https://github.com/ccxt-dev/ccxt/wiki
https://github.com/mongolab/mongodb-driver-examples/blob/master/nodejs/nodeSimpleExample.js

#TODO
- cancel order:  bittrex {"success":false,"message":"INVALID_SIGNATURE","result":null}


#ANALYSIS
- a buy order gets cancelled (1 minute has passed between getting market summary; selecting the ticker and placing the order)
 the ask price is used; but at that moment the ask price has gotten a bit lower. After 10 seconds its not filled; so cancelled.

- a loss happens after 4 hours not sold.

- a profit happens .. 