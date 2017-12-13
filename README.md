Open a new terminal:
- `nvm use 8.9.1` (to support async/await)
- `$ node bittrexBuyer --local --dryRun`
- `$ node bittrexCronjob`
- `$ npm start `

Package used:
https://www.npmjs.com/package/ccxt
https://github.com/ccxt-dev/ccxt/wiki
https://github.com/mongolab/mongodb-driver-examples/blob/master/nodejs/nodeSimpleExample.js

# TODO
- UnhandledPromiseRejectionWarning: Unhandled promise rejection (rejection id: 2): Error: bittrex does not have market symbol BCC/BTC
- UnhandledPromiseRejectionWarning: Unhandled promise rejection (rejection id: 1): Error: bittrex {"success":false,"message":"INSUFFICIENT_FUNDS","result":null}