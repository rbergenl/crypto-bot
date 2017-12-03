var fs = require('fs-extra');
var path = require('path');
var child_process = require('child_process');

var util = require('./util/util');

let bittrexAPI = require('./api/bittrex');
//let coinmarketcapAPI = require('./api/coinmarketcap');

var date = new Date();
var dateStamp = date.toISOString().slice(0,-14);
var timeStamp = (date.getHours()<10?'0':'') + date.getHours().toString() 
                + (date.getMinutes()<10?'0':'') + date.getMinutes().toString();


const BASE_CURRENCY = process.argv[2];
if (BASE_CURRENCY !== 'ETH' & BASE_CURRENCY !== 'BTC') {
    console.error(BASE_CURRENCY + ' is not a valid base currency (BTC or ETH)');
    process.exit(0);
}

var outDir = path.join('./log', dateStamp, 'bittrex' + BASE_CURRENCY + 'Buyer');

// always make sure the outDir exists
fs.mkdirsSync(outDir);

(async () => {

    const LEAVE_BACKUP_FOR_HIGHER_ACTUAL_RATE                   = 0.0001;
    const FEE_PERCENTAGE                                        = 0.0025; // fee = actual price * percentage (paid = 10 units * 1 eth + (1 * 0.0025))
                
    let bittrexMarketSummaries;
    let bittrexMarketSummariesFiltered;
    
    let allTickers;
    let allTickersFiltered;
    
    let selectedTickers = [];
    let selectedTickerMostVolume = [];
    
    let bittrexBalances;
    
    let buyOrders = [];
    
    let buyOrdersPlaced = [];
    
    
    //========== First cancel all outstanding/partial buy orders; so that basecurrency is freed up
    
    //========== Select ETH markets
    try {
        bittrexMarketSummaries = await bittrexAPI.getMarketsSummaries();
        
        // select only desired tickers
        selectedTickers
        = bittrexMarketSummaries.filter(function(ticker){
            return ticker.MarketName.split('-')[0] == BASE_CURRENCY // Select basecurrency markets only
                && ticker.MarketName !== 'BTC-ETH'          // and don't buy new ETH
                && ticker.spread < 2                        // Select only if spread is less than 2% (because will be bought on ask price)
                && ticker.BaseVolume > 20                   // at least quite some trading going on
                && ticker.volume_change_1h > 25
            //    && ticker.volume_change_1h < 20             // volume change 1h up but not too much
                && ticker.volume_change_2h > 25
            //    && ticker.volume_change_2h < 20             // volume change 2h up but not too much
                && ticker.price_change_1h > 0
            //    && ticker.price_change_1h < 15               // price change 1h up but not too much
                && ticker.price_change_2h > 0
            //    && ticker.price_change_2h < 15               // price change 1h up but not too much
                && ticker.price_change_24h > -5             // price development not too negative
                && ticker.price_change_24h < 5;              // and not too positive
                
            /*
            return ticker.MarketName.split('-')[0] == BASE_CURRENCY // Select basecurrency markets only 
                && ticker.spread < 2                        // Select only if spread is less than 2% (because will be bought on ask price)
                && ticker.change_1h_volume > 10         // 20% volume increase last hour
                && ticker.percent_change_1h < 0
                && ticker.percent_change_1h > -5
                && ticker.percent_change_24h > 5        // and in the plus (more than 5%)
                && ticker.percent_change_24h < 20       // but less than 20% increase
                && ticker.MarketName !== 'BTC-ETH';       
            */
        });
    }
    catch(e) {
        console.error(e);
    }
    
    /*
    //========== Select tickers 
    try {
        allTickers          = await coinmarketcapAPI.getTickers();

        allTickersFiltered
        = allTickers.filter(function(ticker){
            //return ticker.change_1h_volume > 10;
            
            
            // So far most effective strategy: 
            if (BASE_CURRENCY == 'ETH') {
                return ticker.percent_change_1h >= 0 // in the plus the last hour
                    && ticker.percent_change_1h < 5 // but not more than 5%
                    && ticker.percent_change_24h > 0 // on the way up the last day
                    && ticker.percent_change_7d < 0; // downtrend for the week
            }
            //Next strategy: 7d -10-20; 24h -5-10, 1 -0-5 
            if (BASE_CURRENCY == 'BTC') {
                return ticker.percent_change_1h <= 0 // in the minus the last hour
                    && ticker.percent_change_1h > -5 // but not more than -5%
                    && ticker.percent_change_24h < -5 // quite some minus last day
                    && ticker.percent_change_24h > -10 // but not radically to much last day
                    && ticker.percent_change_7d < -10 // quite strong downtrend for the week
                    && ticker.percent_change_7d > -20; // nut not radically downtrend
            }
            
        });
    }
    catch(e) {
        console.error(e);
    }

    //================== The ones that are chosen on Bittrex and on Coinmarketcap; should be bought
    try {
        for (let market of bittrexMarketSummariesFiltered) {
            let bittrexTicker = market.MarketName.split('-')[1];
            for (let ticker of allTickersFiltered) {
                if (bittrexTicker == ticker.symbol) {
                    market.change_1h_volume = ticker.change_1h_volume; // add property of coinmarketcap to the bittrex data
                    selectedTickers.push(market);
                }
            }
        }
    }
    catch(e) {
        console.error(e);
    }
    */
    
    
    // So then; just choose the one with the most volume
    selectedTickers.sort(function(a, b){
        return a.BaseVolume - b.BaseVolume;
    })
    // and that ascending order, make it descending (highest on top)
    .reverse();
    // from the chosen ones; if it is more than 2; than the share that goes to each might get to small.
    if (selectedTickers.length > 0) selectedTickerMostVolume.push(selectedTickers[0]);
    
    //================== Now create the buy orders based on available balance
    try {

        let tickersToGo = selectedTickerMostVolume.length;
        for (let market of selectedTickerMostVolume) {
            // wait 5 second before executing each batch of api calls
            console.log('sleeping 2 seconds before executing api calls: ' + tickersToGo + 'x to go.');
            child_process.execSync('sleep 2');
            
            // check available balances
            bittrexBalances = await bittrexAPI.getBalances();
            
            // there is just one chosen ticker (with most volume); give that one the half of available balance; keep a bit for next ticker hour later
            let eachShare = ((bittrexBalances[BASE_CURRENCY].free - LEAVE_BACKUP_FOR_HIGHER_ACTUAL_RATE) / 2).toFixed(8)
            // below is share for no matter how many choosenTickers; and the division is going wrong I guess ( / 4, / 3, /2,.. is not fair)
            //let eachShare = ((bittrexBalances[BASE_CURRENCY].free - LEAVE_BACKUP_FOR_HIGHER_ACTUAL_RATE) / tickersToGo).toFixed(8);
            eachShare -= (eachShare * FEE_PERCENTAGE).toFixed(8);
            tickersToGo--;
            
            // guard conditions
            if (bittrexBalances[BASE_CURRENCY].free == 0) {
                buyOrders.push({"msg": BASE_CURRENCY + ' balance is 0'})
                continue; // make sure there is at least balance available
            }
            
            if (eachShare < 0.0005) {
                buyOrders.push({"msg": market.MarketName + ': order of ' + BASE_CURRENCY + ' ' + eachShare + ' would not be sufficient.'})
                continue; // make sure the order is big enough DUST_TRADE_DISALLOWED_MIN_VALUE_50K_SAT
            }
            
            // define the buy order
            let order = {
                market: market.MarketName,
                ticker: market.MarketName.split('-')[1],
                price: market.Ask,
                ['allocated_' + BASE_CURRENCY]: eachShare,
                units: eachShare / market.Ask
            };
            buyOrders.push(order);
            
            // actually execute the buy order
            let log = await bittrexAPI.buyOrder(order.market, order.units, order.price);
            buyOrdersPlaced.push(log);
        }
        
    }
    catch(e) {
        console.log(e);
    }
    
    await util.logJSON(selectedTickerMostVolume, path.join(outDir, timeStamp + '-selectedTickerMostVolume.json'));
 //   await util.logJSON(allTickersFiltered, path.join(outDir, timeStamp + '-filteredCoinmarketcap.json'));
    await util.logJSON(selectedTickers, path.join(outDir, timeStamp + '-selectedTickers.json'));
    await util.logJSON(buyOrders, path.join(outDir, timeStamp + '-buyOrders.json'));
    await util.logJSON(buyOrdersPlaced, path.join(outDir, timeStamp + '-buyOrdersPlaced.json'));
    
})();
