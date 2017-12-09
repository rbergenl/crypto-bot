var MongoClient = require('mongodb').MongoClient;

// Standard URI format: mongodb://[dbuser:dbpassword@]host:port/dbname
var uri = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DB}`;


module.exports.getAll = function(tableName, fromDatetime, untilDatetime) {
    return new Promise(function (resolve, reject){
        MongoClient.connect(uri, function(err, databases) {
            if(err) console.log(err);
            let db = databases.db(process.env.MONGO_DB);

            db.collection(tableName).find({
                datetime: { $gte: fromDatetime } // when datetime is later than the provided from datetime
            }).toArray(function(err, results){
                let returnData = results.map(function(item) {
                    return item.data;
                });
                resolve(returnData);
            });
            
            databases.close();
        });
    });    
};

module.exports.save = function(tableName, datetime, data) {
    return new Promise(function (resolve, reject){
       MongoClient.connect(uri, function(err, databases) {
            if(err) console.log(err);
            let db = databases.db(process.env.MONGO_DB);
            
            // instert data into table
            db.collection(tableName).insertOne({
                datetime: datetime,
                data: data
            }).then(function(result){
                console.log(datetime + ": saved to Mlab: " + tableName);
                resolve();
            });
            
            databases.close();
        });
    });
};