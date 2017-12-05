Open a new terminal:
- `nvm use 7.6` (to support async/await)
- `$ node bittrexBuyer --local --dryRun`
- `$ node bittrexCronjob`

Package used:
https://www.npmjs.com/package/ccxt
https://github.com/ccxt-dev/ccxt/wiki

http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/dynamodb-example-table-read-write.html


# Had to fix the CCXT module:
``
async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
    //await this.loadMarkets ();
    let market = this.market (symbol);

    let method = 'marketGet' + this.capitalize (side) + type;
    let order = {
        'market': /*market['id']*/ market,
        'quantity': amount.toFixed (8),
    };
    if (type == 'limit')
        order['rate'] = price.toFixed (8);
    let response = await this[method] (this.extend (order, params));
    let result = {
        'info': response,
        'id': response['result']['uuid'],
    };
    return result;
}
``
 
Bittrext Balance:
06-10-2017: 0.02738957 BTC
07-10-2017: 0.02706401 BTC  (GUP and BNT bought with trend: 7d <0, 24h >0, 1h 0-5;.. GUP got sold 2 hours later for 2% profit; BNT sold 8 hours later for 2% profit)
08-10-2017: 0.02619253 BTC
09-10-2017: 0.02291468 BTC
10-10-2017: 0.02234605 BTC
11-10-2017: 0.02438185 BTC
12-10-2017: 0.02143298 BTC
29-11-2017: 0.01330921 BTC
01-12-2017: 0.01316908 BTC
02-12-2017: 0.01305240 BTC
