var fs = require('fs-extra');
var path = require('path');
var moment = require('moment');

var rootDir = path.join('./log');

var date = moment(); //snapshot the moment and work with that

var dateTimeStamp = date.format("YYYYMMDDHHmm");

module.exports.writeJSON = function(slug, data) {
    let outDir = path.join(rootDir, slug);
    // make sure the outDir exists
    fs.mkdirsSync(outDir);
    let outFile = path.join(outDir, dateTimeStamp + '.json');
    
    return new Promise(function (resolve, reject){
        fs.writeFile(outFile, JSON.stringify(data, null, 4), function(err) {
            if(err) {
                require('./util').writeJSON('error', e);
                console.log(err);
                reject();
            }
            console.log("Saved: " + outFile);
            resolve();
        });
    });
};

module.exports.readAllJSON = function(slug, options) {
    let readDir = path.join(rootDir, slug);
    let filenames = fs.readdirSync(readDir);
    
    let JSON_Array = [];
    filenames.forEach(function(filename) {
        let content = fs.readJsonSync(path.join(readDir, filename), 'utf-8');
        JSON_Array.push(content);
    });
    
    if (options.onlyLast > 0) {
        JSON_Array = JSON_Array.slice(Math.max(JSON_Array.length - options.onlyLast, 1));
    }
    
    if (filenames.length == 0) {
        throw 'no json found in ' + readDir + ' with options ' + JSON.stringify(options);
    } else {
        return JSON_Array;
    }
};

module.exports.readJSON = function(slug, options) {
    let readDir = path.join(rootDir, slug);
    let filenames = fs.readdirSync(readDir);
    let filename;
    
    try {
        
        filename = filenames.filter(function(filename) {
            var fileDateArr = filename.split('.');
            var fileDate = fileDateArr[0];
            var fileHowLongAgo = moment(fileDate, 'YYYYMMDDhhmm').fromNow();

            if (options.hoursAgo == 1 && fileHowLongAgo == 'an hour ago') {
                return filename;
            }
            if (options.hoursAgo == 2 && fileHowLongAgo == '2 hours ago'){
                return filename;
            }
            if (options.daysAgo == 1 && fileHowLongAgo == 'a day ago'){
                return filename;
            }
            if (options.daysAgo == 2 && fileHowLongAgo == '2 days ago'){
                return filename;
            }
            
        });
        
        if (filename[0] != undefined) {
            var file = '../' + path.join(readDir, filename[0]);
            return require(file);
        } else {
            throw 'no file found in ' + readDir + ' with options ' + JSON.stringify(options);
        }
    }
    catch(e) {
        require('./util').writeJSON('error', e);
        console.error(e);
        throw e;
    }
    
};
