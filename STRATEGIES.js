/*
All strategies (s) only apply to coins/tokens with volume of 1k+ (low volume is less chance for orders to get fulfilled)

Strategies can have the following code:
s1-cw-t250-7zm10-24p5-1p5i-20t4-60t7-20t10
s2-cd-t500-7zm5-24p10-1p10p20-20t10-50t25-20t2x-10t3x

The code is explained as following:
A previously bought coin/token might not reach the sell orders.
To take the loss and make funds free to buy new coins/tokens:
-> cleanup agressivly next day after buying (cd) or cleanup conservatively next week after buying (cw).

Then deciding which coin/token to buy depends on the following:
-> coins/tokens in the top100, or 250 or 500 (t100)
-> (7) days, (24) hours and (1) hour change:
-> where zeroplus5 (zp5) means 0 to 5, plus5plus10 (p5p10) means 5 to 10 and plus10infinite (p10i) means 10 and more.
-> and zeromin5 (zm5) means 0 to -5, min5min10 (m5m10) means -5 to -10 and min10inifinite (m10i) means -10 and less. 

After a coin/token is bought its sell orders should be placed accordingly:
-> 20% of units bought, sell it after 4% increase: 20% to 4% (20t4)
-> 25% of units bought, sell it for 2 times increase: 25% to 2x (25t2x)

This way; a wide range of strategies can be defined and tested.

*/

module.exports = {
    // NAME: [DAYTRADE AGRESSIVE] BUY AFTER DEEP DIP QUICKLY ON THE WAY UP
    // clean: every day new opportunities
    // buy: lost a lot in the last week and even lost a bit last day, but last hour is quite a lot going up already
    // sell: 
    's1-cd-t500-7m20i-24zm10-1p5i-20t4-60t7-20t10': {
        buy: function(ticker) {
            return parseInt(ticker.rank) <= 500
                && ticker['24h_volume_usd'] >= 1000
                && ticker.percent_change_7d <= -20
                && ticker.percent_change_24h <= 0 
                && ticker.percent_change_24h >= -10
                && ticker.percent_change_1h >= 5;
        },
        sell: [
            (function(market) {
                return {
                    units: Math.round(market.units * 0.2),
                    ask: market.buyRate * 1.04
                }
            }),
            (function(market){
                return {
                    units: Math.round(market.units * 0.6),
                    ask: market.buyRate * 1.07
                }
            }),
            (function(market){
                return { 
                    units: parseFloat((market.units
                                - market.sellTrades[0].units
                                - market.sellTrades[1].units).toFixed(8)),
                    ask: parseFloat((market.buyRate * 1.1).toFixed(10))
                }
            })
        ]
    },
    // NAME: [DAYTRADE CONSERVATIVE] BUY AFTER MEDIUM DIP SLOWLY ON THE WAY UP
    // clean: give sell orders a week the time to get hit
    's2': {
        buy: function(ticker) {
            return parseInt(ticker.rank) <= 500
                && ticker['24h_volume_usd'] >= 1000
        	    && ticker.percent_change_7d >= 20 
                && ticker.percent_change_24h >= 10 
                && ticker.percent_change_1h >= 0;
        },
        sell: []
    },
    's3': {
        buy: function(ticker) {
            return parseInt(ticker.rank) <= 500
                && ticker['24h_volume_usd'] >= 1000
                && ticker.percent_change_7d <= -10
                && ticker.percent_change_24h < 0
                && ticker.percent_change_24h > -10
                && ticker.percent_change_1h > 0;
        },
        sell: []
    }
};

