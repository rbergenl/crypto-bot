var child_process = require('child_process');
var moment = require('moment');

var util = require('./util/util');

let bittrexAPI = require('./api/bittrex');

const BASE_CURRENCY = process.argv[2];
if (BASE_CURRENCY !== 'ETH' & BASE_CURRENCY !== 'BTC') {
    console.error(BASE_CURRENCY + ' is not a valid base currency (BTC or ETH)');
    process.exit(0);
}

const SLUG = 'bittrexTsunami_' + BASE_CURRENCY;

const LEAVE_BACKUP_FOR_HIGHER_ACTUAL_RATE                   = 0.0001;
const FEE_PERCENTAGE                                        = 0.0025; // fee = actual price * percentage (paid = 10 units * 1 eth + (1 * 0.0025))
const TARGET_PERCENT                                        = 1.0125; // +1.25%
const MIN_TSUNAMI_SCORE                                     = 2;
const CANCEL_ORDER_AFTER_MINUTES                            = 360;

(async () => {

    let bittrexMarketSummaries;
     
    let selectedTickers = [];

    let bittrexBalances;
    let bittrexOpenOrders;
    
    let buyOrders = [];
    let ordersCancelled = [];
    let buyOrdersPlaced = [];
    
    let calculatedOrders = [];
    let sellOrdersPlaced = [];
   


    //========== First cancel all outstanding sell orders that are overdue; so that basecurrency is freed up
    try {
        
        bittrexOpenOrders = await bittrexAPI.getOpenOrders();

        for (let order of bittrexOpenOrders) {

            // if it is a sell order open for longer than 6 hours, cancel that order (all other sell orders stay open)
            if(order.side == 'sell') {
                let now = moment();
                let then = order.datetime;
                let minutesAgo = moment.duration(now.diff(then)).minutes();
                
                if (minutesAgo > CANCEL_ORDER_AFTER_MINUTES) {
                    await bittrexAPI.cancelOrder(order.id);
                    ordersCancelled.push(order);
                }

            }
        }

    }
    catch(e) {
        util.throwError(e);
    }
    
    //==========  fetch market summaries and select markets
    try {
        
        bittrexMarketSummaries = await bittrexAPI.getMarketsSummaries({save:true});

        // select only desired tickers
        selectedTickers
        = bittrexMarketSummaries.filter(function(ticker){
            return ticker.MarketName.split('-')[0] == BASE_CURRENCY // Select basecurrency markets only
                && ticker.MarketName !== 'BTC-ETH'          // and don't buy new ETH
                && ticker.spread < 2
                && ticker.BaseVolume > 100
                && ticker.volume_change_1h > 0
                && ticker.volume_change_2h > 0
                && ticker.price_change_1h > 0
                && ticker.price_change_2h > 0
                && ticker.price_change_24h > 0; 
        });
        
    }
    catch(e) {
        util.throwError(e);
    }

    // Then choose the top five with the most volume
    selectedTickers.sort(function(a, b){
        return a.BaseVolume - b.BaseVolume;
    })
    // and that ascending order, make it descending (highest on top)
    .reverse();
    selectedTickers = selectedTickers.slice(0, 5);
    
    // from the chosen ones; check order by biggest tsunami
    try {
        
        let tickersToGo = selectedTickers.length;
        let index = 0;
        let orderBook;
        for (let market of selectedTickers) {
            // wait 5 second before executing each batch of api calls
            console.log('sleeping 2 seconds before executing api call fetchOrderBook (' + market.MarketName + '): ' + tickersToGo + 'x to go.');
            child_process.execSync('sleep 2');
            
            // check orderbook
            orderBook = await bittrexAPI.fetchOrderBook(market.MarketName);
            
            selectedTickers[index].bidsTsunamiScore = orderBook.bidsTsunamiScore;
            tickersToGo--;
            index++;
        }

    }
    catch(e) {
        util.throwError(e);
    }
    
    // Then choose the one with the highest tsunamiScore
    selectedTickers.sort(function(a, b){
        return a.bidsTsunamiScore - b.bidsTsunamiScore;
    })
    // and that ascending order, make it descending (highest on top)
    .reverse();

    //================= Continue from here with one selected ticker
    // only execute one order and if TsunamiScore is above 2
    let oneSelectedTicker = selectedTickers.slice(0, 1);
    if (oneSelectedTicker[0] && oneSelectedTicker[0].bidsTsunamiScore < MIN_TSUNAMI_SCORE) oneSelectedTicker.splice(0, 1); // remove first item

    //================== Now create the buy orders based on available balance
    try {

        let tickersToGo = oneSelectedTicker.length;
        for (let market of oneSelectedTicker) {
            // wait 5 second before executing each batch of api calls
            console.log('sleeping 2 seconds before executing api calls: ' + tickersToGo + 'x to go.');
            child_process.execSync('sleep 2');
            
            // check available balances
            bittrexBalances = await bittrexAPI.getBalances();
            
            // there is just one chosen ticker (with most volume); give that one 70% of available balance; keep a bit for next ticker hour later (and spread risk; not all in a possible loss)
            let eachShare = ((bittrexBalances[BASE_CURRENCY].free - LEAVE_BACKUP_FOR_HIGHER_ACTUAL_RATE) / 1.4).toFixed(8);
            // below is share for no matter how many choosenTickers; and the division is going wrong I guess ( / 4, / 3, /2,.. is not fair)
            //let eachShare = ((bittrexBalances[BASE_CURRENCY].free - LEAVE_BACKUP_FOR_HIGHER_ACTUAL_RATE) / tickersToGo).toFixed(8);
            eachShare -= (eachShare * FEE_PERCENTAGE).toFixed(8);
            tickersToGo--;
            
            // guard conditions
            if (bittrexBalances[BASE_CURRENCY].free == 0) {
                buyOrders.push({"msg": BASE_CURRENCY + ' balance is 0'});
                continue; // make sure there is at least balance available
            }
            
            if (eachShare < 0.0005) {
                buyOrders.push({"msg": market.MarketName + ': order of ' + BASE_CURRENCY + ' ' + eachShare + ' would not be sufficient.'});
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
        util.throwError(e);
    }
    
    
    //================== Now cancel if buy order is still open
    
    // wait 10 seconds for the buy order to be processed; then cancel open standing buy orders
    console.log('sleeping 10 seconds before executing api calls');
    child_process.execSync('sleep 10');
    
    try {
        
        bittrexOpenOrders = await bittrexAPI.getOpenOrders();

        for (let order of bittrexOpenOrders) {
            
            // if it is a buy order; than just cancel that order (it might be partially filled)
            if(order.side == 'buy') {
                await bittrexAPI.cancelOrder(order.id);
                ordersCancelled.push(order);
            }
        }
    }
    catch(e) {
        util.throwError(e);
    }
    
     // wait 2 seconds for the buy order to be processed; then place the sell order
    console.log('sleeping 2 seconds before executing api calls');
    child_process.execSync('sleep 2');
    
            
    //========== Sell the available balance of the just bought coin
    try {

        // place the sell order for the 
        for (let market of oneSelectedTicker) {

            // get fresh new updated balances
            bittrexBalances = await bittrexAPI.getBalances();
        
            // get only the balance for the specific market (BCC was only avaiable in the info array... they dont keep updated)
            let availableUnits;
            let currentMarketBalance = bittrexBalances.info.filter(function(ticker){
                return ticker.Currency == market.symbol;
            });
            if (currentMarketBalance.length == 0) {
                availableUnits = bittrexBalances.free[market.symbol];
            } else {
                availableUnits = currentMarketBalance[0].Available;
            }
            
            if (availableUnits > 0) {
                
                let order = {
                    marketName: market.MarketName,
                    units: availableUnits,
                    targetPrice: parseFloat((market.Ask * TARGET_PERCENT).toFixed(8))
                };
                calculatedOrders.push(order);

                // place the sell order with the free amount, for the desired target price
                let log = await bittrexAPI.sellOrder(order.marketName, order.units, order.targetPrice);
                sellOrdersPlaced.push(log);
            }
        }
    }
    catch(e) {
        util.throwError(e);
    }    
    

    //========== For all the balance that is then still free; sell it for bid price (might be from 6 hours old sell order; possible loss)
    try {
         // get fresh new updated balances
        bittrexBalances = await bittrexAPI.getBalances();
        
        // get only the balance for the specific market (BCC was only avaiable in the info array... they dont keep updated)
        let freeBalances = bittrexBalances.info.filter(function(ticker){
            return ticker.Available > 0;
        });
        
        for (let free of freeBalances) {
           
             // only sell if the currency is not ETH and BTC and USDT
            if (free.Currency != 'ETH' && free.Currency != 'BTC' && free.Currency != 'USDT') {
                let market = bittrexMarketSummaries.filter(function(market){
                    return market.MarketName.split('-')[0] == BASE_CURRENCY // Select basecurrency markets only
                        && market.MarketName.split('-')[1] == free.Currency;
                });

                let order = {
                    marketName: market[0].MarketName,
                    units: free.Available,
                    targetPrice: parseFloat((market[0].Bid).toFixed(8))
                };
                calculatedOrders.push(order);
    
                // place the sell order with the free amount, for the desired target price
                let log = await bittrexAPI.sellOrder(order.marketName, order.units, order.targetPrice);
                sellOrdersPlaced.push(log);
            }
        }
        
    }
    catch(e) {
        util.throwError(e);
    }

    let jsonOut = {
        ordersCancelled: ordersCancelled,
        selectedTickers: selectedTickers,
        buyOrders: buyOrders,
        buyOrdersPlaced: buyOrdersPlaced,
        calculatedOrders: calculatedOrders,
        sellOrdersPlaced: sellOrdersPlaced
    };
    
    await util.writeJSON(SLUG, jsonOut);
    console.log(jsonOut); // and write to console for build log
    
})();
