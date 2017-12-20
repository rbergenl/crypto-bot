var util = require('./util/util');

(async () => {
    let latestReports = await util.readJSON('bittrexReporter', {onlyLast: 7});
    
    let allOrders = [];
    latestReports.forEach(function(report){
        for (let order of report.orders) {
            allOrders.push(order);
        }
    });

    await util.writeJSON('csv', allOrders, {toFile:true, asCSV: true});
})();