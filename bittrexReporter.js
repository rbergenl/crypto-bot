var fs = require('fs-extra');
var path = require('path');
var util = require('./util/util');
var moment = require('moment');
var mailGun = require('mailgun-js');

let bittrexAPI = require('./api/bittrex');

let bittrexTrend = require('./bittrexTrend');

var doEmail = (process.argv[2] == '--email') ? true : false;

var date = moment(); //snapshot the moment and work with that
var dateTimeStamp = date.format("YYYY-MM-DD_HHmm").toUpperCase();
var dateTimeStampOneDayAgo = date.subtract(1, 'day').format("YYYY-MM-DD_HHmm").toUpperCase();

var outDir = path.join('./log/bittrexReporter');

// always make sure the outDir exists
fs.mkdirsSync(outDir);


(async () => {
    let bittrexMarketSummaries;
    let bittrexBalances;
    let report = {};
    
    try {
        bittrexMarketSummaries = await bittrexAPI.getMarketsSummaries();
        bittrexBalances = await bittrexAPI.getBalances();
        
        report['datetime'] = dateTimeStamp;
        
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
        
        let file = path.join(outDir, dateTimeStampOneDayAgo + '.json');
        
        (async () => {
            fs.stat(file, function(err, stat) {
                if(err == null) {
                    console.log('File exists');
                    let previousReport = require('./' + file);
                    
                    report.value_btc_change_24h = (1 - (previousReport.value_btc / report.value_btc));
                    report.value_btc_change_24h =  parseFloat((report.value_btc_change_24h).toFixed(2));
                    
                } else if(err.code == 'ENOENT') {
                    // file does not exist
                    console.log('report from one day ago does not exist');
                } else {
                    console.log('Some other error: ', err.code);
                }
            });
        })();
        
    }
    catch(e) {
        console.error(e);
    } 
    
    //======================= Get the trend, attach it to the report and send it via email
    var text = bittrexTrend.getText();
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
        console.error(e);
    }
    
    await util.logJSON(report, path.join(outDir, dateTimeStamp + '.json'));
    
})();


