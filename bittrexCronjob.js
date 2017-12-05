var cron = require('node-cron');
var moment = require('moment');
const child_process = require("child_process");

/*
 # ┌────────────── second (optional)
 # │ ┌──────────── minute
 # │ │ ┌────────── hour
 # │ │ │ ┌──────── day of month
 # │ │ │ │ ┌────── month
 # │ │ │ │ │ ┌──── day of week
 # │ │ │ │ │ │
 # │ │ │ │ │ │
 # * * * * * *
*/

var hourly = moment().add(1, 'minutes').format('m') + ' * * * *';
var nightly = '1 0 * * *';

console.log('Bittrex Cronjob started at: ' + moment().format("YYYY-MM-DD HH:mm:ss"));
console.log('Make sure node 7.6 is being used!');
console.log(hourly + ' is valid: ' + cron.validate(hourly));
console.log(nightly + ' is valid: ' + cron.validate(nightly));

cron.schedule(hourly, function(){
    let command = 'node bittrexTsunami BTC';
    console.log(moment().format("YYYY-MM-DD_HHmm") + ': $ ' + command);
    child_process.execSync(command);
});

// run 1 minute past 12 at night
cron.schedule(nightly, function(){
    let command = 'node bittrexReporter --email';
    console.log(moment().format("YYYY-MM-DD_HHmm") + ': $ ' + command);
    child_process.execSync(command);
});