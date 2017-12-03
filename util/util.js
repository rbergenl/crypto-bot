var fs = require('fs');


module.exports.logJSON = function(data, file) {
    return new Promise(function (resolve, reject){
        fs.writeFile(file, JSON.stringify(data, null, 4), function(err) {
            if(err) {
                console.log(err);
                reject();
            }
            console.log("Saved: " + file);
            resolve();
        });
    });
}