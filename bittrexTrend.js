var moment = require('moment');
var fs = require('fs-extra');
var path = require('path');


var readDir = path.join('./log/bittrexReporter');

// constants
let ONE_HUNDRED_DAYS_FROM_NOW = moment().add(100, 'days'); //snapshot date 100 days from now
let OUTPUT_DATE_100_DAYS = ONE_HUNDRED_DAYS_FROM_NOW.format("YYYY-MM-DD");
let ONE_MILLION = 1000000;

// variables
let MAX_BTC_USDT = 50000; // what if maximum btc value is this amount of dollars
let BTC_USD_INCREASE_PER_DAY = 1.005; // what if the btc price increase is a half percent per day
let CONSOLE_INDEX = 0;


// base all information on the data found in the reports
let reports = [];
let filenames = fs.readdirSync(readDir);
filenames.forEach(function(filename) {
    let content = fs.readJsonSync(path.join(readDir, filename), 'utf-8');
    reports.push(content);
});

// get latest values
let current_btc_usdt = reports[reports.length-1].btc_usdt;
let current_btc_units = reports[reports.length-1].value_btc;

// calculate average 24h
let sum = 0;
for( var i = 0; i < reports.length; i++ ){
    sum += parseFloat(reports[i].value_btc_change_24h, 10); //don't forget to add the base
}
let average24h_change = parseFloat((sum / reports.length).toFixed(2));
let percent = 1 + (average24h_change / 100);
if (percent == 1) percent = 1.0001; // when there is no change, it will never reach a million (and the calculation will get in a loop)


module.exports.getText = function() {
    let text = currentPortfolio()
            + whenMillionaire(0)
            + whenMillionaire(1000)
            + valueInOneHundredDays()
            + howMuchNeededNowToBeMillionaireInOneHundredDays();
    return text;
};


//====================================== IMPLEMENTATION DETAILS =======================
function currentPortfolio() {
    return `${CONSOLE_INDEX++}) today (${moment().format("YYYY-MM-DD")}) you have:  
    USD ${parseInt(current_btc_usdt * current_btc_units, 10)}.  
    BTC ${current_btc_units}.  
    BTC_USDT ${current_btc_usdt}.  
    (average24h_change ${average24h_change})
    
`;
}

function whenMillionaire(contribution) {
    let newBTC_USDT = current_btc_usdt;
    let newBTC_Units = current_btc_units;
    let newUSD = (newBTC_Units * newBTC_USDT);
    let newDate = moment();
    newBTC_Units += (contribution / current_btc_usdt);

    while (newUSD < ONE_MILLION) {
        // determine new value for the next day
        newDate = newDate.add(1, 'days');
        newBTC_USDT = (newBTC_USDT > MAX_BTC_USDT) ? MAX_BTC_USDT : (newBTC_USDT * BTC_USD_INCREASE_PER_DAY);
        newBTC_Units = (newBTC_Units * percent);
    
        newUSD = (newBTC_Units * newBTC_USDT);
        if (newUSD < 10) break;
    }
    
    // format for output
    newUSD = parseInt(newUSD, 10);
    newBTC_USDT = parseInt(newBTC_USDT, 10);
    newBTC_Units = parseFloat((newBTC_Units).toFixed(2));
    
    let howLongToGo = moment(newDate, moment()).fromNow();
    newDate = newDate.format("YYYY-MM-DD");
    
    return `${CONSOLE_INDEX++}) ${howLongToGo} (${newDate}) you have:
    USD ${newUSD}.
    BTC ${newBTC_Units}.
    BTC_USDT ${newBTC_USDT} (${BTC_USD_INCREASE_PER_DAY}).
    (average24h_change ${average24h_change})
    - if you contribute ${contribution} now.
    
`;
}

function valueInOneHundredDays() {
    let in_100_days_BTC_USDT = current_btc_usdt;
    let in_100_days_BTC_UNITS = current_btc_units;
    let in_100_days_USD = (in_100_days_BTC_USDT * in_100_days_BTC_UNITS);
    
    for (let i = 0; i < 100; i++) {
        in_100_days_BTC_USDT = (in_100_days_BTC_USDT * BTC_USD_INCREASE_PER_DAY);
        in_100_days_BTC_UNITS = (in_100_days_BTC_UNITS * percent);
        
        in_100_days_USD = (in_100_days_BTC_USDT * in_100_days_BTC_UNITS);
    }
    in_100_days_BTC_USDT = parseInt(in_100_days_BTC_USDT, 10);
    in_100_days_USD = parseInt(in_100_days_USD, 10);
    in_100_days_BTC_UNITS = parseFloat((in_100_days_BTC_UNITS).toFixed(2));
    
    return `${CONSOLE_INDEX++}) in 100 days (${OUTPUT_DATE_100_DAYS}) you have:
    USD ${in_100_days_USD}.
    BTC ${in_100_days_BTC_UNITS}.
    BTC_USDT ${in_100_days_BTC_USDT} (${BTC_USD_INCREASE_PER_DAY}).
    (average24h_change ${average24h_change})
    - if you contribute 0 now.
    
`;
}

function howMuchNeededNowToBeMillionaireInOneHundredDays() {
    
    let newBTC_USDT;
    let newBTC_Units;
    let newUSD = 0;
    let contribution = 0;

    while (newUSD < ONE_MILLION) {
        contribution += 100;
        newBTC_USDT = current_btc_usdt;
        newBTC_Units = current_btc_units;
        newBTC_Units += (contribution / current_btc_usdt);
        
        newUSD = (newBTC_Units * newBTC_USDT);
        
        for (let i = 0; i < 100; i++) {
            // determine new value for the next day
            newBTC_USDT = (newBTC_USDT > MAX_BTC_USDT) ? MAX_BTC_USDT : (newBTC_USDT * BTC_USD_INCREASE_PER_DAY);
            newBTC_Units = (newBTC_Units * percent);
            newUSD = (newBTC_Units * newBTC_USDT);
        }
        if (newUSD < 10) break;
        if (newUSD > ONE_MILLION) break;
    }
    
    newBTC_USDT = parseInt(newBTC_USDT, 10);
    newBTC_Units = parseFloat((newBTC_Units).toFixed(2));

    return `${CONSOLE_INDEX++}) in 100 days (${OUTPUT_DATE_100_DAYS}) you have:
    USD ${ONE_MILLION}. 
    BTC ${newBTC_Units}.
    BTC_USDT ${newBTC_USDT} (${BTC_USD_INCREASE_PER_DAY}).
    (average24h_change of ${average24h_change})
    - if you contribute ${contribution} now.

`;
}

