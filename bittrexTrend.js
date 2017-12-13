var moment = require('moment');

// constants
let ONE_HUNDRED_DAYS_FROM_NOW = moment().add(100, 'days'); //snapshot date 100 days from now
let OUTPUT_DATE_100_DAYS = ONE_HUNDRED_DAYS_FROM_NOW.format("YYYY-MM-DD");
let ONE_MILLION = 1000000;

// variables
let MAX_BTC_USDT = 50000; // what if maximum btc value is this amount of dollars
let BTC_USD_INCREASE_PER_DAY = 1.005; // what if the btc price increase is a half percent per day
let CONSOLE_INDEX = 0;

module.exports.getText = function(report) {
    
    let currentReport = Object.assign({}, report); // use new object, not the reference (due to making changes to the object)
    
    if (currentReport.value_btc_change_7d == 0 || currentReport.value_btc_change_7d == null)
        currentReport.value_btc_change_7d = 0.01;
    currentReport['value_btc_change_7d_percent'] = 1 + (currentReport.value_btc_change_7d / 100);

    let text = currentPortfolio(currentReport)
            + whenMillionaire(currentReport, 0)
            + whenMillionaire(currentReport, 1000)
            + valueInOneHundredDays(currentReport)
            + howMuchNeededNowToBeMillionaireInOneHundredDays(currentReport);
    return text;
};


//====================================== IMPLEMENTATION DETAILS =======================

function currentPortfolio(currentReport) {
    
    let msg = `${CONSOLE_INDEX++}) today (${moment().format("YYYY-MM-DD")}) you have:  
    USD ${parseInt(currentReport.btc_usdt * currentReport.value_btc, 10)}.  
    BTC ${currentReport.value_btc}.
    BTC_USDT ${currentReport.btc_usdt}.
    24H_CHANGE ${currentReport.value_btc_change_24h}.
    7D_CHANGE ${currentReport.value_btc_change_7d}.
    
`;
    for(let order of currentReport.orders) {
        msg += `${order.time} - ${order.symbol} - ${order.side} - ${order.filled} * ${order.price} = ${parseFloat((order.filled*order.price).toFixed(8))}\n`;
        if (order.tsunami) msg += `(h24: ${order.h24} h2: ${order.h2} h1: ${order.h1} v2: ${order.v2} v1: ${order.v1} tsunami: ${order.tsunami}) \n`;
    }
return msg + '\n';

}


function whenMillionaire(currentReport, contribution) {
    let newBTC_USDT = currentReport.btc_usdt;
    let newBTC_Units = currentReport.value_btc;
    let newUSD = (newBTC_Units * newBTC_USDT);
    let newDate = moment();
    newBTC_Units += (contribution / currentReport.btc_usdt);

    while (newUSD < ONE_MILLION) {
        // determine new value for the next day
        newDate = newDate.add(1, 'days');
        newBTC_USDT = (newBTC_USDT > MAX_BTC_USDT) ? MAX_BTC_USDT : (newBTC_USDT * BTC_USD_INCREASE_PER_DAY);
        newBTC_Units = (newBTC_Units * currentReport.value_btc_change_7d_percent);
    
        newUSD = (newBTC_Units * newBTC_USDT);
        if (newUSD < 10) break;
    }
    
    // format for output
    newUSD = parseInt(newUSD, 10);
    newBTC_USDT = parseInt(newBTC_USDT, 10);
    newBTC_Units = parseFloat((newBTC_Units).toFixed(3));
    
    let howLongToGo = moment(newDate, moment()).fromNow();
    newDate = newDate.format("YYYY-MM-DD");
    
    return `${CONSOLE_INDEX++}) ${howLongToGo} (${newDate}) you have:
    USD ${newUSD}.
    BTC ${newBTC_Units} (${currentReport.value_btc_change_7d_percent}).
    BTC_USDT ${newBTC_USDT} (${BTC_USD_INCREASE_PER_DAY}).
    - if you contribute ${contribution} now.
    
`;
}


function valueInOneHundredDays(currentReport) {
    let in_100_days_BTC_USDT = currentReport.btc_usdt;
    let in_100_days_BTC_UNITS = currentReport.value_btc;
    let in_100_days_USD = (in_100_days_BTC_USDT * in_100_days_BTC_UNITS);
    
    for (let i = 0; i < 100; i++) {
        in_100_days_BTC_USDT = (in_100_days_BTC_USDT * BTC_USD_INCREASE_PER_DAY);
        in_100_days_BTC_UNITS = (in_100_days_BTC_UNITS * currentReport.value_btc_change_7d_percent);
        
        in_100_days_USD = (in_100_days_BTC_USDT * in_100_days_BTC_UNITS);
    }
    in_100_days_BTC_USDT = parseInt(in_100_days_BTC_USDT, 10);
    in_100_days_USD = parseInt(in_100_days_USD, 10);
    in_100_days_BTC_UNITS = parseFloat((in_100_days_BTC_UNITS).toFixed(3));
    
    return `${CONSOLE_INDEX++}) in 100 days (${OUTPUT_DATE_100_DAYS}) you have:
    USD ${in_100_days_USD}.
    BTC ${in_100_days_BTC_UNITS}  (${currentReport.value_btc_change_7d_percent}).
    BTC_USDT ${in_100_days_BTC_USDT} (${BTC_USD_INCREASE_PER_DAY}).
    - if you contribute 0 now.
    
`;
}

function howMuchNeededNowToBeMillionaireInOneHundredDays(currentReport) {
    
    let newBTC_USDT;
    let newBTC_Units;
    let newUSD = 0;
    let contribution = 0;

    while (newUSD < ONE_MILLION) {
        contribution += 100;
        newBTC_USDT = currentReport.btc_usdt;
        newBTC_Units = currentReport.value_btc;
        newBTC_Units += (contribution / currentReport.btc_usdt);
        
        newUSD = (newBTC_Units * newBTC_USDT);
        
        for (let i = 0; i < 100; i++) {
            // determine new value for the next day
            newBTC_USDT = (newBTC_USDT > MAX_BTC_USDT) ? MAX_BTC_USDT : (newBTC_USDT * BTC_USD_INCREASE_PER_DAY);
            newBTC_Units = (newBTC_Units * currentReport.value_btc_change_7d_percent);
            newUSD = (newBTC_Units * newBTC_USDT);
        }
        if (newUSD < 10) break;
        if (newUSD > ONE_MILLION) break;
    }
    
    newBTC_USDT = parseInt(newBTC_USDT, 10);
    newBTC_Units = parseFloat((newBTC_Units).toFixed(3));

    return `${CONSOLE_INDEX++}) in 100 days (${OUTPUT_DATE_100_DAYS}) you have:
    USD ${ONE_MILLION}. 
    BTC ${newBTC_Units} (${currentReport.value_btc_change_7d_percent}).
    BTC_USDT ${newBTC_USDT} (${BTC_USD_INCREASE_PER_DAY}).
    - if you contribute ${contribution} now.

`;
}
