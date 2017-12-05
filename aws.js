var AWS = require('aws-sdk');

// Set the region 
AWS.config.update({region: 'us-east-2'});

// Point externally
//AWS.config.update({endpoint: "https://dynamodb.us-east-2.amazonaws.com"});

// Create the DynamoDB service object
let ddb = new AWS.DynamoDB({apiVersion: '2012-10-08'});

var params = {
  TableName: 'bittrexTsunami_BTC',
  ProjectionExpression: 'orders'
};

// Call DynamoDB to read the item from the table
ddb.scan(params, function(err, data) {
  if (err) {
    console.log("Error", err);
  } else {
    console.log("Success", data);
  }
});