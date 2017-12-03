var fs = require('fs');
var path = require('path');
var util = require('../util/util');

var dateStamp = new Date().toISOString().slice(0,-14);
var outDir = path.join('./raw', dateStamp);

var local = (process.argv[2] == '--local' || process.argv[3] == '--local' || process.argv[4] == '--local') ? true : false;

var request = require('request');

module.exports.getTickers = function() {
    return new Promise(function (resolve, reject){
        if (local) {
            resolve(require('../raw/' + dateStamp + '/allTickers.json'))
        } else {
            request('https://api.coinmarketcap.com/v1/ticker/', function (error, response, body) {
              if (!error && response.statusCode == 200) {
                var fetchedJson = JSON.parse(body);
                var previousJson = require('../raw/' + dateStamp + '/allTickers.json');
                                    
                (async () => {
                    // before printing it out; 
                    // filter the list to have only the top 500 coins and more than 1k volume to work with
                    var filteredJson = fetchedJson.filter(function(ticker){
                        return parseInt(ticker.rank) <= 500
                            && ticker['24h_volume_usd'] >= 1000;
                    });
                    
                    //actually read the existing allTickers.json; and add calculated change_1h_volume
                    // (the code checks the previously loaded data; and this one is fetched every hour)
                    var calculatedJson = filteredJson.map((ticker) => {
                        //if (!ticker.hasOwnProperty('24_volume_usd')) return ticker;
                        var prevVolume = previousJson.find(x => x.id === ticker.id)['24h_volume_usd'];
                        ticker.change_1h_volume = (1 - (ticker['24h_volume_usd'] / prevVolume)) * 100;
                        return ticker;
                    });

                    await util.logJSON(calculatedJson, path.join(outDir, 'allTickers.json'));
                    resolve(calculatedJson);
                })();

              }
            });
        }
    });
};