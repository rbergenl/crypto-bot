var AWS = require('aws-sdk');
var uuid = require('node-uuid');

// Set the region 
AWS.config.update({region: 'us-east-2'});

// Create the DynamoDB service object
let dynamodb = new AWS.DynamoDB({apiVersion: '2012-10-08'});

module.exports.getAll = function(tableName, fromDatetime, untilDatetime) {

    return new Promise(function (resolve, reject){
        var params = {
            TableName: tableName,
            FilterExpression: "#column BETWEEN :val1 and :val2",
            ExpressionAttributeNames: {
                '#column': 'datetime'
            },
            ExpressionAttributeValues: {
                ':val1': {'S': fromDatetime},
                ':val2': {'S': untilDatetime}
             }
        };
        
        dynamodb.scan(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err); // an error occurred
            }
            else {
                let returnData = data.Items.map(function(item) {
                    return JSON.parse(item.data.S);
                });
                resolve(returnData);// successful response
            }
        });
    });    
};

module.exports.save = function(tableName, datetime, data) {
    return new Promise(function (resolve, reject){
        
        data = JSON.stringify(data);

        var params = {
            Item: {
                "id": {
                    S: uuid.v1()
                },
                "datetime": {
                    S: datetime
                }, 
                "data": {
                    S: data
                }
            },
            TableName: tableName,
            ReturnConsumedCapacity: "TOTAL"
        };

        dynamodb.putItem(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err); // an error occurred
            }
            else {
                console.log(datetime + ": saved to DynamoDB: " + tableName);
                resolve();// successful response
            }
        });

    });
};
