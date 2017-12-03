var fs = require('fs-extra');
var path = require('path');
var util = require('../util/util');
var moment = require('moment');

var date = moment(); //snapshot the moment and work with that

var dateTimeStamp = date.format("YYYY-MM-DD_HHmm").toUpperCase();
var dateTimeStampOneHourAgo = date.subtract(1, 'hours').format("YYYY-MM-DD_HHmm").toUpperCase();
var dateTimeStampTwoHourAgo = date.subtract(2, 'hours').format("YYYY-MM-DD_HHmm").toUpperCase();

var outDir = path.join('./raw', 'bittrex', dateTimeStamp);

var local = (process.argv[2] == '--local' || process.argv[3] == '--local' || process.argv[4] == '--local') ? true : false;
var dryRun = (process.argv[2] == '--dryRun' || process.argv[3] == '--dryRun' || process.argv[4] == '--dryRun') ? true : false;

var request = require('request');
var ccxt = require ('ccxt');

let bittrexCCXT = new ccxt.bittrex({
    'apiKey': process.env.BITTREX_API_KEY, // standard
    'secret': process.env.BITTREX_SECRET_KEY
});
                
// always make sure the outDir exists
fs.mkdirsSync(outDir);


module.exports.getMarkets = function() {
    request('https://bittrex.com/api/v1.1/public/getmarkets', function (error, response, body) {
      if (!error && response.statusCode == 200) {
        var json = JSON.parse(body);
        
        var outFile = path.join(outDir, 'bittrex-markets.json');
        fs.writeFile(outFile, JSON.stringify(json, null, 4), function(err) {
            if(err) {
                return console.log(err);
            }
            console.log("The file was saved!");
        });
      }
    });
};

module.exports.getMarketsSummaries = function() {
    return new Promise(function (resolve, reject){
        if (local) {
            return resolve(require('../test/bittrex/bittrex-marketsSummaries.json'));
        } else {
            request('https://bittrex.com/api/v1.1/public/getmarketsummaries', function (error, response, body) {
              if (!error && response.statusCode == 200) {
                var fetchedJson = JSON.parse(body);
                var OneHourAgoJson;
                var TwoHourAgoJson;

                try {
                    OneHourAgoJson = require('../raw/bittrex/' + dateTimeStampOneHourAgo + '/bittrex-marketsSummaries.json');
                    TwoHourAgoJson = require('../raw/bittrex/' + dateTimeStampTwoHourAgo + '/bittrex-marketsSummaries.json');
                }
                catch(e) {
                    console.log('could not find previous bittrex market summaries (1 or 2 hours ago); so using just fetched one');
                    OneHourAgoJson = fetchedJson.result; // as fallback, use fetchedJson (thus volume_change_1h would be 0 for each ticker)
                    TwoHourAgoJson = fetchedJson.result; // as fallback, use fetchedJson (thus volume_change_2h would be 0 for each ticker)
                }
                 
                (async () => {
                    // add extra calculated properties
                    var calculatedJson = fetchedJson.result.map((ticker) => {
                        ticker.price_change_24h = (1 - (ticker.PrevDay / ticker.Last)) * 100;
                        ticker.spread = (1 - (ticker.Bid / ticker.Ask)) * 100;
                        ticker.symbol = ticker.MarketName.split('-')[1];
                        
                        var prevVolume1h = OneHourAgoJson.find(x => x.MarketName === ticker.MarketName).BaseVolume;
                        var prevVolume2h = TwoHourAgoJson.find(x => x.MarketName === ticker.MarketName).BaseVolume;
                        ticker.volume_change_1h = (1 - (ticker.BaseVolume / prevVolume1h)) * 100;
                        ticker.volume_change_2h = (1 - (ticker.BaseVolume / prevVolume2h)) * 100;
                        
                        var prevPrice1h = OneHourAgoJson.find(x => x.MarketName === ticker.MarketName).Last;
                        var prevPrice2h = TwoHourAgoJson.find(x => x.MarketName === ticker.MarketName).Last;
                        ticker.price_change_1h = (1 - (ticker.Last / prevPrice1h)) * 100;
                        ticker.price_change_2h = (1 - (ticker.Last / prevPrice2h)) * 100;
                        
                        return ticker;
                    });
                    await util.logJSON(calculatedJson, path.join(outDir, 'bittrex-marketsSummaries.json'));
                    resolve(calculatedJson);
                })();
              }
            });
        }
    });
};

module.exports.getBalances = function() {
    return new Promise(function (resolve, reject){
        (async () => {
            if (local) {
                resolve(require('../test/bittrex/bittrex-balances.json'));
            } else {
                
                //let bittrexMarkets          = await bittrexCCXT.loadMarkets()
                let json = await bittrexCCXT.fetchBalance();
                
                await util.logJSON(json, path.join(outDir, 'bittrex-balances.json'));
                resolve(json);
            }
        })();
    });
};

module.exports.buyOrder = function(symbol, units, price) {
    return new Promise(function (resolve, reject){
        if(dryRun) {
            resolve({"dryRun":true});
        } else {
            (async () => {
                //createOrder (symbol, type, side, amount, price = undefined, params = {})
                // Bittrex does not allow MarketBuyOrder placed by bots, only limitBuyOrder
                let json = await bittrexCCXT.createLimitBuyOrder(symbol, units, price)
                resolve(json)
            })();
        }
    });
};

module.exports.sellOrder = function(symbol, units, price) {
    return new Promise(function (resolve, reject){
        if(dryRun) {
            resolve({"dryRun":true});
        } else {
            (async () => {
                //createOrder (symbol, type, side, amount, price = undefined, params = {})
                let json = await bittrexCCXT.createLimitSellOrder(symbol, units, price);
                resolve(json);
            })();
        }
    });
};

module.exports.getOrders = function() {
    return new Promise(function (resolve, reject){
        (async () => {
            if (local) {
                resolve(require('../test/bittrex/bittrex-orders.json'));
            } else {
                let json = await bittrexCCXT.fetchOrders();
                await util.logJSON(json, path.join(outDir, 'bittrex-orders.json'));

                resolve(json);
            }
        })();
    });
};

module.exports.getOpenOrders = function() {
    return new Promise(function (resolve, reject){
        (async () => {
            if (local) {
                resolve(require('../test/bittrex/bittrex-ordersOpen.json'));
            } else {
                let json = await bittrexCCXT.fetchOpenOrders();
                await util.logJSON(json, path.join(outDir, 'bittrex-ordersOpen.json'));

                resolve(json);
            }
        })();
    });
};

module.exports.cancelOrder = function(id) {
    return new Promise(function (resolve, reject){
        if(dryRun) {
            resolve({"dryRun":true});
        } else {
            (async () => {
                let json = await bittrexCCXT.cancelOrder(id);
                resolve(json);
            })();
        }
    });
};

module.exports.fetchOrderBook = function(id) {
    return new Promise(function (resolve, reject){
        (async () => {
            if (local) {
                resolve(require('../test/bittrex/bittrex-orderbook.json'));
            } else {
                let json = await bittrexCCXT.fetchOrderBook(id);
                json.bids = json.bids.slice(0, 250);
                json.asks = json.asks.slice(0, 250);
                
                json.bids = json.bids.map(function(row){
                    return row[0] * row[1];
                })
                json.bidsBTC = 0;
                json.bids.forEach(function(rowBTC){
                    json.bidsBTC += rowBTC;
                })
                
                json.asks = json.asks.map(function(row){
                    return row[0] * row[1];
                })
                json.asksBTC = 0;
                json.asks.forEach(function(rowBTC){
                    json.asksBTC += rowBTC;
                })
                json.bidsTsunamiScore = parseFloat((json.bidsBTC / json.asksBTC).toFixed(2));
        
               // await util.logJSON(json, path.join(outDir, 'bittrex-orderbook.json'));

                resolve(json);
            }
        })();
    });
};
