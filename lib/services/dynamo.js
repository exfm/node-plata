"use strict";

var util = require('util'),
    when = require('when'),
    EventEmitter = require('events').EventEmitter,
    aws = require('../aws'),
    Connection = aws.Connection,
    STS = require('./sts'),
    plog = require('plog'),
    log = plog('plata.dynamo');

function Dynamo(key, secret){
    Dynamo.super_.call(this, key, secret,
        'dynamodb.us-east-1.amazonaws.com', '2011-12-05');
    this.log = log;
    this.actionQueue = [];
    this.ready = true;
}
util.inherits(Dynamo, Connection);

Dynamo.prototype.signatureVersion = 4;
Dynamo.prototype.name = 'DynamoDB';
Dynamo.prototype.scope = 'dynamodb';
Dynamo.prototype.contentType = 'json';
// aws.dynamo
//     .on('retry', function(err){

//     }).on('successful retry', function(err){
//         console.log('Retry suceeded after hitting error ' + err);
//     });
// Low level API's.
// @todo (lucas) Consolidate this into "driver" or something?  Low level is confusing.
Dynamo.prototype.action = function(action, data){
    if(!this.ready){
        var d = when.defer();
        this.actionQueue.push([d, action, data]);
        return d.promise;
    }
    var self = this;
    return this.request('/').action(action).json(data)
        .on('retry', function(err){
            self.log.debug('Retrying because of err ' + err);
            self.emit('retry', err, action, data);
        })
        .on('successful retry', function(err){
            self.log.debug('Retry suceeded after encountering error ' + err);
            self.emit('successful retry', err, action, data);
        })
        .end(function(res){
            if(res.ConsumedCapacityUnits){
                self.emit('stat', {
                    'action': action,
                    'consumed': res.ConsumedCapacityUnits
                }, action, data);
            }
           //  @todo (lucas) Handle batch responses
           //  "Responses":{
           //    "Thread":{
           //       "ConsumedCapacityUnits":1.0
           //    },
           //    "Reply":{
           //       "ConsumedCapacityUnits":1.0
           //    }
           // },


            return res;
        });
};

Dynamo.prototype.getItem = function(data){
    return this.action('GetItem', data);
};

Dynamo.prototype.putItem = function(data){
    return this.action('PutItem', data);
};

Dynamo.prototype.updateItem = function(data){
    return this.action('UpdateItem', data);
};

Dynamo.prototype.deleteItem = function(data){
    return this.action('DeleteItem', data);
};

Dynamo.prototype.batchWriteItem = function(data){
    return this.action('BatchWriteItem', data);
};

Dynamo.prototype.batchGetItem = function(data){
    return this.action('BatchGetItem', data);
};

Dynamo.prototype.listTables = function(data){
    return this.action('ListTables', data);
};

Dynamo.prototype.createTable = function(data){
    return this.action('CreateTable', data);
};

Dynamo.prototype.describeTable = function(data){
    return this.action('DescribeTable', data);
};

Dynamo.prototype.updateTable = function(data){
    return this.action('UpdateTable', data);
};

Dynamo.prototype.deleteTable = function(data){
    return this.action('DeleteTable', data);
};

Dynamo.prototype.scan = function(data){
    return this.action('Scan', data);
};

Dynamo.prototype.query = function(data){
    return this.action('Query', data);
};

module.exports = Dynamo;