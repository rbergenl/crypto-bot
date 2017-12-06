var fs = require('fs-extra');
var path = require('path');
var util = require('./util/util');
var child_process = require('child_process');

let bittrexAPI = require('./api/bittrex');
    
var date = new Date();
var dateStamp = date.toISOString().slice(0,-14);
var timeStamp = (date.getHours()<10?'0':'') + date.getHours().toString() 
                + (date.getMinutes()<10?'0':'') + date.getMinutes().toString();

var outDir = path.join('./log', dateStamp, 'bittrexSeller');

// always make sure the outDir exists
fs.mkdirsSync(outDir);

(async () => {
    
    const TARGET_PERCENT                   = 1.0325; // +3.25%
    
    let bittrexBalances;
    let freeTickers = [];
    let bittrexOrders;
    let bittrexClosedBuyOrders;
    let bittrexMarketSummaries;
    let calculatedOrders = {};
    let sellOrdersPlaced = [];
    
    //========== First cancel all sell orders; so that funds are freed to sell for what is best at the moment
    
    //========== First cancel also all outstanding/partial buy orders (otherwise it might get processed later; without a sell order)


    //========== Check how much balance is available of each coin/token
    try {
        // get fresh new updated balances
        bittrexBalances = await bittrexAPI.getBalances();
        
        for (let ticker in bittrexBalances.free) {
            if (bittrexBalances.free[ticker] > 0) 
                if (ticker !=='ETH' && ticker !== 'BTC') freeTickers.push(ticker);
        }
        
        // Then, for each free ticker; fetch the latest buyOrders and marketSummaries
        bittrexOrders = await bittrexAPI.getOrders();
        bittrexMarketSummaries = await bittrexAPI.getMarketsSummaries();
        
        // only use the orders that are buy and closed
        bittrexClosedBuyOrders = bittrexOrders.filter(function(ticker){
            return ticker.side == 'buy'
                && ticker.status == 'closed';
        });
        
        for (let freeTicker of freeTickers) {
            calculatedOrders[freeTicker] = {
                balanceFree: bittrexBalances.free[freeTicker],
                buyOrdersClosedOrderedByDateTime: []
            };
            
            let closedBuyOrders = bittrexClosedBuyOrders.filter(function(ticker){
                //only get the orders relevant for that ticker
               return ticker.symbol.split('/')[0] === freeTicker;
            }).map(function(ticker){
                // only get the needed propperties (for a clean object to work with)
                let latestMarketAsk = bittrexMarketSummaries.find(x => x.MarketName === ticker.info['Exchange']).Ask;
                let latestMarketBid = bittrexMarketSummaries.find(x => x.MarketName === ticker.info['Exchange']).Bid;
                let targetPrice = parseFloat((ticker.info['PricePerUnit'] * TARGET_PERCENT).toFixed(8));
                let percentToTarget = (1 - (targetPrice / latestMarketBid)) * 100;
                
                return {
                    market: ticker.info['Exchange'],
                    id: ticker.id,
                    closedDateTime: ticker.info['Closed'],
                    closedDateTimestamp: Date.parse(ticker.info['Closed']),
                    type: ticker.type,
                    side: ticker.side,
                    filled: ticker.filled,
                    pricePerUnit: ticker.info['PricePerUnit'],
                    targetPrice: targetPrice,
                    latestMarketAsk: latestMarketAsk,
                    latestMarketBid: latestMarketBid,
                    percentToTarget: percentToTarget
                }
            });
            
            // make sure the newest closed orders are on top
            closedBuyOrders.sort(function(a, b){
                return a.closedDateTimestamp - b.closedDateTimestamp;
            })
            // and that ascending order, make it descending (newest on top)
            .reverse();
            
            calculatedOrders[freeTicker].buyOrdersClosedOrderedByDateTime = closedBuyOrders;
        }
       
        // ordered by Closed dateTime (start with most recent
        // is the latest Ask (from marketsummary) more than 3% compared to the pricePerUnit?; then place a sell order for that price (minus 1) with amount_filled.
        // if not; then at least subtract that amount from the free balance
        // (so it is reservered for next hour; and so it is not sold for a lower price, becaue of a different lower buy order)
        // if still amount free; then check the next closed buy order. Is more latest ask more than 3% compared to pricePerUnit?
        for (let symbol in calculatedOrders) {
            let availableBalance = calculatedOrders[symbol].balanceFree;
            
        /*
            // just always sell the available balance at the current price (because it was bought with intention it should have been increased)
            let log = await bittrexAPI.sellOrder(
                    calculatedOrders[symbol].buyOrdersClosedOrderedByDateTime[0].market,
                    availableBalance,
                    calculatedOrders[symbol].buyOrdersClosedOrderedByDateTime[0].latestMarketBid);
            sellOrdersPlaced.push(log);
        */
        
        // place the sell order with the free amount, for the desired target price
        let log = await bittrexAPI.sellOrder(
                    calculatedOrders[symbol].buyOrdersClosedOrderedByDateTime[0].market,
                    availableBalance,
                    calculatedOrders[symbol].buyOrdersClosedOrderedByDateTime[0].targetPrice);
            sellOrdersPlaced.push(log);
            
         
                // or loop through each closed buy order; and place the sell order accordingly          
/*            for (let order of calculatedOrders[symbol].buyOrdersClosedOrderedByDateTime) {
                if (order.latestMarketBid >= order.targetPrice && availableBalance >= order.filled) {
                    order.allocatedForSell = order.filled
                    
                    // wait 5 second before executing each batch of api calls
                    console.log('sleeping 1 second before executing api call');
                    child_process.execSync('sleep 1');

                    // now also actually place the order
                    let log = await bittrexAPI.sellOrder(order.market, order.allocatedForSell, order.latestMarketBid);
                    sellOrdersPlaced.push(log);

                } else {
                    order.allocatedForSell = 0
                }
                availableBalance -= order.filled;
            };*/
        }
    }
    catch(e) {
        console.log(e)
    }
    
    await util.logJSON(calculatedOrders, path.join(outDir, timeStamp + '-calculatedOrders.json'));
    await util.logJSON(sellOrdersPlaced, path.join(outDir, timeStamp + '-sellOrdersPlaced.json'));
    
})();
