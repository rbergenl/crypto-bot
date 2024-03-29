var moment = require('moment');
var mailGun = require('mailgun-js');
var Readable = require('stream').Readable;

let bittrexAPI = require('./api/bittrex');
var util = require('./util/util');

let bittrexTrend = require('./bittrexTrend');

var doEmail = (process.argv[2] == '--email') ? true : false;

const SLUG = 'bittrexReporter';

if (moment().hours() != 0) {
    console.log(moment().format('YYYYMMDDHHmm') + ': ' + SLUG + ' not executing since hours at this moment is not 0');
    process.exit();
}

(async () => {
    let bittrexMarketSummaries;
    let bittrexBalances;
    let report = {};
    
    try {
        bittrexMarketSummaries = await bittrexAPI.getMarketsSummaries();
        bittrexBalances = await bittrexAPI.getBalances();
        
        report['datetime'] = moment();
        
        // get btc_usd rate
        report['btc_usdt'] = bittrexMarketSummaries.filter(function(market){
                                return market.MarketName == 'USDT-BTC';
                            }).map(function(market){
                                return market.Last;
                            })[0];
        report.btc_usdt = parseFloat((report.btc_usdt).toFixed(2));
        
        // calculate total btc value
        report['value_btc'] = 0;
        for (let market of bittrexBalances.info) {
            
            if (market.Balance > 0) {
                
                let withBalanceMarketName = 'BTC-' + market.Currency;
                let calculatedBTCValue = 0;
                
                // if BTC then add that balance
                if (market.Currency == 'BTC') {
                    calculatedBTCValue = market.Balance;
                }
                else if (market.Currency == 'USDT') {
                    calculatedBTCValue = bittrexMarketSummaries.filter(function(ticker){
                                return ticker.MarketName == 'USDT-BTC';
                            }).map(function(ticker){
                                return (market.Balance / ticker.Last);
                            })[0];
                } else {
                    // otherwise calculate btc value based on balance and last price.
                    calculatedBTCValue = bittrexMarketSummaries.filter(function(ticker){
                                return ticker.MarketName == withBalanceMarketName;
                            }).map(function(ticker){
                                //console.log(ticker)
                                return (market.Balance * ticker.Last);
                            })[0];
                }
                report.value_btc += calculatedBTCValue;
            }
        }
        report.value_btc = parseFloat((report.value_btc).toFixed(8));
        
        report['value_usd'] = parseFloat((report.value_btc * report.btc_usdt).toFixed(2));
        
        // calculate 24h value change
        report['value_btc_change_24h'] = 0;
        
        try {
            // fetch from 2 days ago and use only last one, otherwise 1 day ago might be missed getting fetched by a minute..
            let previousReport = await util.readJSON(SLUG, {daysAgo: 2, onlyLast:1});

            report.value_btc_change_24h = (1 - (previousReport.value_btc / report.value_btc));
            report.value_btc_change_24h =  parseFloat((report.value_btc_change_24h).toFixed(3));
           
        }
        catch(e) {
            util.throwError('report from one day ago does not exist, cannot compare, so value_btc_change_24h will be 0');
        }
        
        // calculate 7d value change
        report['value_btc_change_7d'] = 0;
        
        try {
            let latestReports = await util.readJSON('bittrexReporter', {onlyLast: 7});
            
            // calculate average 24h from past week
            let sum = 0;
            for(var i = 0; i < latestReports.length; i++ ){
                sum += parseFloat(latestReports[i].value_btc_change_24h, 10); //don't forget to add the base
            }
            
            if (latestReports.length > 0) {
                report.value_btc_change_7d = parseFloat((sum / latestReports.length).toFixed(3));
            } else {
                // cannot calculate last 7 days change; so then using last day change instead
                report.value_btc_change_7d = report.value_btc_change_24h;
            }
        }
        catch(e) {
            util.throwError(e);
        }
        
    }
    catch(e) {
        util.throwError(e);
    } 
    
    
    try {
       // bittrexOrders = await bittrexAPI.getOrders();
       // get the bittrexTsunami logs from last 24h
        let bittrexTsunami = await util.readJSON('bittrexTsunami_BTC', {daysAgo: 1});
        report['orders'] = [];
        
        // only orders from past 24h
        for (let previousReport of bittrexTsunami) {
            for (let cancelled of previousReport.ordersCancelled) {
                let cancelledOrder = await bittrexAPI.getOrder(cancelled.id)
                report.orders.push({
                    date: moment(cancelledOrder.datetime).format('YYYYMMDD'),
                    time: moment(cancelledOrder.datetime).format('HH:mm:ss'),
                    symbol: cancelledOrder.symbol,
                    side:'cancelled',
                    filled: cancelledOrder.filled,
                    price: cancelledOrder.price
                });
            }
            
            for (let bought of previousReport.buyOrdersPlaced) {
                report.orders.push({
                    date: moment(previousReport.selectedTickers[0].TimeStamp).format('YYYYMMDD'),
                    time: moment(previousReport.selectedTickers[0].TimeStamp).format('HH:mm:ss'),
                    symbol: previousReport.buyOrders[0].market,
                    side: 'buy',
                    filled: previousReport.buyOrders[0].units,
                    price: previousReport.buyOrders[0].price,
                    h24: previousReport.selectedTickers[0].price_change_24h.toFixed(2),
                    h2: previousReport.selectedTickers[0].price_change_2h.toFixed(2),
                    h1: previousReport.selectedTickers[0].price_change_1h.toFixed(2),
                    v2: previousReport.selectedTickers[0].volume_change_2h.toFixed(2),
                    v1: previousReport.selectedTickers[0].volume_change_1h.toFixed(2),
                    tsunami: previousReport.selectedTickers[0].orderBook ? previousReport.selectedTickers[0].orderBook.tsunami250 : previousReport.selectedTickers[0].bidsTsunamiScore,
                    basevolume: previousReport.selectedTickers[0].BaseVolume.toFixed(0),
                    buyorders: previousReport.selectedTickers[0].OpenBuyOrders,
                    sellorders: previousReport.selectedTickers[0].OpenSellOrders,
                    orderbook: previousReport.selectedTickers[0].orderBook ? previousReport.selectedTickers[0].orderBook : null,
                    USDT_BTC: previousReport.selectedTickers[0].USDT_BTC ? previousReport.selectedTickers[0].USDT_BTC : null
                });
            }
            
            for (let sold of previousReport.sellOrdersPlaced) {
                let soldOrder = await bittrexAPI.getOrder(sold.id);
                if (soldOrder.status == 'closed') {
                    report.orders.push({
                        date: moment(soldOrder.info.Closed).format('YYYYMMDD'),
                        time: moment(soldOrder.info.Closed).format('HH:mm:ss'),
                        symbol: previousReport.calculatedOrders[0].marketName,
                        side: 'sell',
                        filled: previousReport.calculatedOrders[0].units,
                        price:  previousReport.calculatedOrders[0].targetPrice
                    });
                }
            }
        }

    }
    catch(e) {
        util.throwError(e);
    }  

    //======================= Get the trend, attach it to the report and send it via email
    var text = bittrexTrend.getText(report);
    report['trend'] = text;
    var csvOrders = await util.JSONtoCSV(report.orders);

    var stream = new Readable;
    stream.push(csvOrders);    // the string you want
    stream.push(null);      // indicates end-of-file basically - the end of the stream
    
    try {
        var api_key = process.env.MAILGUN_API_KEY;
        var domain = 'sandbox811c617bc5884829bca1a2b832d887c2.mailgun.org';
        var mailgun = mailGun({apiKey: api_key, domain: domain});
        
        var attachment = new mailgun.Attachment({
            data: stream,
            filename: moment().format('YYYYMMDD') + '_orders.csv',
            knownLength: Buffer.byteLength(csvOrders, 'utf8'),
            contentType: 'text/csv'
        });
        
        var data = {
          from: 'Crypto Bot <me@samples.mailgun.org>',
          to: process.env.MAILGUN_TO_EMAIL,
          subject: 'Daily Bittrex BTC Status',
          attachment: attachment,
          text: text
        };
        
        if (doEmail) {
            mailgun.messages().send(data, function (error, body) {
              console.log(body);
            });
        }
        
    }
    catch(e) {
        util.throwError(e);
    }
    
    await util.writeJSON(SLUG, report);
   // console.log(report);  // and write to console for build log
   //     await util.writeJSON(SLUG, report, {toFile:true});
   // await util.writeJSON(SLUG, report.orders, {toFile:true, asCSV: true});
    
})();


