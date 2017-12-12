var moment = require('moment');
var mailGun = require('mailgun-js');

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
    let bittrexOrders;
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
        bittrexOrders = await bittrexAPI.getOrders();
        
        // only orders from past 24h
        let now = moment();
        bittrexOrders = bittrexOrders.filter(function(order){
            let then = order.datetime;
            let daysAgo = moment.duration(now.diff(then)).days();
            return daysAgo == 0; // should be 0 (so within last 24 hours)
        }).map(function(order){
            return {
                symbol: order.symbol,
                side: order.side,
                status: order.status,
                filled: order.filled,
                price: order.price,
                time: moment(order.timestamp).format('hh:mm:ss')
            };
        });
        
        report['orders'] = bittrexOrders;
    }
    catch(e) {
        util.throwError(e);
    }  

    //======================= Get the trend, attach it to the report and send it via email
    var text = bittrexTrend.getText(report);
    report['trend'] = text;
    
    try {
        var api_key = process.env.MAILGUN_API_KEY;
        var domain = 'sandbox811c617bc5884829bca1a2b832d887c2.mailgun.org';
        var mailgun = mailGun({apiKey: api_key, domain: domain});
        
        var data = {
          from: 'Crypto Bot <me@samples.mailgun.org>',
          to: process.env.MAILGUN_TO_EMAIL,
          subject: 'Daily Bittrex BTC Status',
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
    
    //await util.writeJSON(SLUG, report, {toFile:true});
    await util.writeJSON(SLUG, report);
   // console.log(report);  // and write to console for build log
    
})();


