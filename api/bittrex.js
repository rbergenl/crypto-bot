var child_process = require('child_process');

var request = require('request');
var ccxt = require ('ccxt');

var util = require('../util/util');

var local = (process.argv[2] == '--local' || process.argv[3] == '--local' || process.argv[4] == '--local') ? true : false;
var dryRun = (process.argv[2] == '--dryRun' || process.argv[3] == '--dryRun' || process.argv[4] == '--dryRun') ? true : false;

let bittrexCCXT = new ccxt.bittrex({
    'apiKey': process.env.BITTREX_API_KEY, // standard
    'secret': process.env.BITTREX_SECRET_KEY
});

module.exports.getMarkets = function() {
    
    const SLUG = 'bittrex_markets';

    request('https://bittrex.com/api/v1.1/public/getmarkets', function (error, response, body) {
      if (!error && response.statusCode == 200) {
        var json = JSON.parse(body);
        
        (async () => {
            await util.writeJSON(SLUG, JSON.stringify(json, null, 4));
        })();
      }
    });
};

module.exports.getMarketsSummaries = function(options = {}) {
    
    const SLUG = 'bittrex_marketsSummaries';
    
    return new Promise(function (resolve, reject){
        if (local) {
            return resolve(require('../test/bittrex/bittrex-marketsSummaries.json'));
        } else {
            request('https://bittrex.com/api/v1.1/public/getmarketsummaries', function (error, response, body) {
              if (!error && response.statusCode == 200) {
                var fetchedJson = JSON.parse(body);
                var OneHourAgoJson;
                var TwoHourAgoJson;

                (async () => {
                    try {
                        OneHourAgoJson = await util.readJSON(SLUG, {hoursAgo: 1, onlyLast: 1});
                    }
                    catch(e) {
                        util.throwError('could not find previous bittrex market summaries (1 hour ago); so using just fetched one');
                        OneHourAgoJson = fetchedJson.result; // as fallback, use fetchedJson (thus volume_change_1h would be 0 for each ticker)
                    }
                    
                    try {
                        TwoHourAgoJson = await util.readJSON(SLUG, {hoursAgo: 2, onlyLast: 1});
                    }
                    catch(e) {
                         util.throwError('could not find previous bittrex market summaries (2 hours ago); so using just fetched one');
                         TwoHourAgoJson = fetchedJson.result; // as fallback, use fetchedJson (thus volume_change_2h would be 0 for each ticker)
                    }
                    
                    // add extra calculated properties
                    var calculatedJson = fetchedJson.result.map((ticker) => {
                        ticker.price_change_24h = (1 - (ticker.PrevDay / ticker.Last)) * 100;
                        ticker.spread = (1 - (ticker.Bid / ticker.Ask)) * 100;
                        ticker.symbol = ticker.MarketName.split('-')[1];
                        
                        var sameMarket1h = OneHourAgoJson.find(x => x.MarketName === ticker.MarketName);
                        var sameMarket2h = TwoHourAgoJson.find(x => x.MarketName === ticker.MarketName);
                        
                        var prevVolume1h = sameMarket1h ? sameMarket1h.BaseVolume : ticker.BaseVolume;
                        var prevVolume2h = sameMarket2h ? sameMarket2h.BaseVolume : ticker.BaseVolume;
                        ticker.volume_change_1h = (1 - (ticker.BaseVolume / prevVolume1h)) * 100;
                        ticker.volume_change_2h = (1 - (ticker.BaseVolume / prevVolume2h)) * 100;
                        
                        var prevPrice1h = sameMarket1h ? sameMarket1h.Last : ticker.Last;
                        var prevPrice2h = sameMarket2h ? sameMarket2h.Last : ticker.Last;
                        ticker.price_change_1h = (1 - (ticker.Last / prevPrice1h)) * 100;
                        ticker.price_change_2h = (1 - (ticker.Last / prevPrice2h)) * 100;
                        
                        return ticker;
                    });
                
                    if (options.save) await util.writeJSON(SLUG, calculatedJson);
                //    console.log(calculatedJson)
                    resolve(calculatedJson);
                })();
              }
            });
        }
    });
};

module.exports.getBalances = function() {
    
    const SLUG = 'bittrex_balances';
   
    return new Promise(function (resolve, reject){
        (async () => {
            if (local) {
                resolve(require('../test/bittrex/bittrex-balances.json'));
            } else {
                // wait 1 seconds
                console.log('sleeping 1 second before executing api call (getBalances)');
                child_process.execSync('sleep 1');            
                //let bittrexMarkets          = await bittrexCCXT.loadMarkets()
                let json = await bittrexCCXT.fetchBalance();
                //await util.writeJSON(SLUG, json);
                resolve(json);
            }
        })();
    });
};

module.exports.buyOrder = function(market, units, price) {
    return new Promise(function (resolve, reject){
        if(dryRun) {
            resolve({"dryRun":true});
        } else {
            (async () => {
                // wait 5 second before executing each batch of api calls
                console.log(`sleeping 1 seconds before executing api call: ${market} ${units} * ${price} (buyOrder).`);
                child_process.execSync('sleep 1');

                let symbol = market.split('-')[1] + '/' + market.split('-')[0]; // transformation needed for ccxt
                //createOrder (symbol, type, side, amount, price = undefined, params = {})
                // Bittrex does not allow MarketBuyOrder placed by bots, only limitBuyOrder
                try {
                    let json = await bittrexCCXT.createLimitBuyOrder(symbol, units, price);
                     // wait 10 seconds for the buy order to be processed; then cancel open standing buy orders
                    console.log('sleeping 10 seconds wait for buy order to be filled');
                    child_process.execSync('sleep 10');
                    resolve(json);
                }
                catch (e) {
                    if (e.includes('does not have market symbol')) {
                        try {
                            // try again with original market symbol
                            console.log(`placing order (try again), but now for: ${symbol} ${units} * ${price}`);
                            let json = await bittrexCCXT.createLimitBuyOrder(market, units, price);
                            // wait 10 seconds for the buy order to be processed; then cancel open standing buy orders
                            console.log('sleeping 10 seconds wait for buy order to be filled');
                            child_process.execSync('sleep 10');
                            resolve(json);
                        }
                        catch(e) {
                            reject(e);
                        }
                    }
                    if (e.includes('INSUFFICIENT_FUNDS')) {
                        console.log('error handled due to INSUFFICIENT_FUNDS');
                        reject(e);
                    }
                }
                
            })();
        }
    });
};

module.exports.sellOrder = function(market, units, price) {
    return new Promise(function (resolve, reject){
        if(dryRun) {
            resolve({"dryRun":true});
        } else {
            (async () => {
                let symbol = market.split('-')[1] + '/' + market.split('-')[0]; // transformation needed for ccxt
               // let symbol = id.split('-')[1] + '/' + id.split('-')[0]; // transformation needed for ccxt
                //createOrder (symbol, type, side, amount, price = undefined, params = {})
                try {
                    console.log(`placing sell order: ${symbol} ${units} * ${price}`);
                    let json = await bittrexCCXT.createLimitSellOrder(symbol, units, price);
                    resolve(json);
                }
                catch(e) {
                    reject(e);
                }
            })();
        }
    });
};


module.exports.getOrder = function(id) {
    
    const SLUG = 'bittrex_order';
  
    return new Promise(function (resolve, reject){
        (async () => {
            if (local) {
                resolve(require('../test/bittrex/bittrex-orders.json'))[0];
            } else {
                let json = await bittrexCCXT.fetchOrder(id);
               // await util.writeJSON(SLUG, json);
                resolve(json);
            }
        })();
    });
};


module.exports.getOrders = function() {
    
    const SLUG = 'bittrex_orders';
  
    return new Promise(function (resolve, reject){
        (async () => {
            if (local) {
                resolve(require('../test/bittrex/bittrex-orders.json'));
            } else {
                let json = await bittrexCCXT.fetchOrders();
               // await util.writeJSON(SLUG, json);
                resolve(json);
            }
        })();
    });
};

module.exports.getOpenOrders = function() {
    
    const SLUG = 'bittrex_ordersOpen';
    
    return new Promise(function (resolve, reject){
        (async () => {
            if (local) {
                resolve(require('../test/bittrex/bittrex-ordersOpen.json'));
            } else {
                let json = await bittrexCCXT.fetchOpenOrders();
                //await util.writeJSON(SLUG, json);
                resolve(json);
            }
        })();
    });
};

module.exports.cancelOrder = function(orderId) {
    return new Promise(function (resolve, reject){
        if(dryRun) {
            resolve({"dryRun":true});
        } else {
            (async () => {
                let json = await bittrexCCXT.cancelOrder(orderId);
                console.log('order cancelled: ' + json);
                console.log('sleeping 3 seconds to wait for order to be cancelled and balances updated');
                child_process.execSync('sleep 3');
                resolve(json);
            })();
        }
    });
};

module.exports.fetchOrderBook = function(market) {
    return new Promise(function (resolve, reject){
        (async () => {
            if (local) {
                resolve(require('../test/bittrex/bittrex-orderbook.json'));
            } else {
                let json;
                // wait 5 second before executing each batch of api calls
                console.log('sleeping 2 seconds before executing api call: ' + market + ' (fetchOrderBook).');
                child_process.execSync('sleep 2');
            
                try {
                    let symbol = market.split('-')[1] + '/' + market.split('-')[0]; // transformation needed for ccxt
                    console.log(`fetching orderbook for: ${symbol}`);
                    json = await bittrexCCXT.fetchOrderBook(symbol);
                }
                catch (e) {
                    if (e.includes('does not have market symbol')) {
                        try {
                            // try again with original market symbol
                            console.log(`fetchin orderbook for: ${market} (try again)`);
                            json = await bittrexCCXT.fetchOrderBook(market);
                        }
                        catch (e) {
                            reject(e);
                        }
                    } else {
                        reject(e);
                    }
                }
                json.bids = json.bids.slice(0, 250);
                json.asks = json.asks.slice(0, 250);
                
                json.bids = json.bids.map(function(row){
                    return row[0] * row[1];
                });
                json.bidsBTC = 0;
                json.bids.forEach(function(rowBTC){
                    json.bidsBTC += rowBTC;
                });
                
                json.asks = json.asks.map(function(row){
                    return row[0] * row[1];
                });
                json.asksBTC = 0;
                json.asks.forEach(function(rowBTC){
                    json.asksBTC += rowBTC;
                });
                json.bidsTsunamiScore = parseFloat((json.bidsBTC / json.asksBTC).toFixed(2));

                resolve(json);
            }
        })();
    });
};
