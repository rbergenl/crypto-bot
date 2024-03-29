var fs = require('fs-extra');
var path = require('path');
var moment = require('moment');
var jsonexport = require('jsonexport');

var dynamo = require('../api/dynamo');
var mlab = require('../api/mlab');

var rootDir = path.join('./log');

var date = moment(); //snapshot the moment and work with that

var dateTimeStamp = date.format('YYYYMMDDHHmm');

module.exports.writeJSON = function(slug, data, options) {
    return new Promise(function (resolve, reject){
        (async () => {
            if (options && options.toFile == true) {
                
                let outDir = path.join(rootDir, slug);
                // make sure the outDir exists
                fs.mkdirsSync(outDir);
                
                if(options.asCSV == true) {
                    let outFile = path.join(outDir, dateTimeStamp + '.csv');
                    require('./util').JSONtoCSV(data).then(function(csv_out){
                        fs.writeFile(outFile, csv_out, function(err) {
                            if(err) {
                                require('./util').throwError(err);
                                reject();
                            }
                            console.log("Saved: " + outFile);
                            resolve();
                        });
                    });
                    
                } else {
                    let outFile = path.join(outDir, dateTimeStamp + '.json');
                    fs.writeFile(outFile, JSON.stringify(data, null, 4), function(err) {
                        if(err) {
                            require('./util').throwError(err);
                            reject();
                        }
                        console.log("Saved: " + outFile);
                        resolve();
                    });
                }
            } else {
                await mlab.save(slug, dateTimeStamp, data);
                resolve();
            }
            
        })();
    });
};


module.exports.readJSON = function(slug, options) {
    return new Promise(function (resolve, reject){
        (async () => {
            try {
                let allData;
                
                let momentAgo = {n: 7, t: 'days'}; // default get data up to a week ago
                
                momentAgo = (options.hoursAgo == 1) ? {n:1,t:'hours'} : momentAgo;
                momentAgo = (options.hoursAgo == 2) ? {n:2,t:'hours'} : momentAgo;
                momentAgo = (options.daysAgo == 1) ? {n:1,t:'days'} : momentAgo;
                momentAgo = (options.daysAgo == 2) ? {n:2,t:'days'} : momentAgo;
                
                let fromDatetime = moment().subtract(momentAgo.n, momentAgo.t).format('YYYYMMDDHHmm');

                let untilDatetime = dateTimeStamp;
                
                allData = await mlab.getAll(slug, fromDatetime, untilDatetime);

                // if only 1 item is desired; then don't return an array
                if (allData.length > 0 && options.onlyLast == 1) {
                    allData = allData[0];
                }
                
                // from all return items; take only the last ones (if the array is bigger than 1, otherwise it will slice to 0)
                if (allData.length > 0 && options.onlyLast > 1) {
                    allData = allData.slice(Math.max(allData.length - options.onlyLast, 1));
                }

                if (allData != undefined) {
                    //require('./util').writeJSON(slug, allData, {toFile:true});
                    resolve(allData);
                } else {
                    reject('no data found for ' + slug + ' with options ' + JSON.stringify(options));
                }
            }
            catch(e) {
                require('./util').throwError(e);
            }
        })();
    });
};

module.exports.JSONtoCSV = function(json) {
    return new Promise(function (resolve, reject){
        jsonexport(json,function(err, csv){
            if(err) reject(err);
            resolve(csv);
        });
    });
};

module.exports.throwError = function(e){
    //require('./util').writeJSON('error', e);
    console.log(dateTimeStamp + ': ' + e);
};