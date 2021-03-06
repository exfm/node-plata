"use strict";

var util = require('util'),
    Q = require('q'),
    EventEmitter = require('events').EventEmitter,
    aws = require('../aws'),
    Connection = aws.Connection,
    STS = require('./sts'),
    plog = require('plog'),
    log = plog('plata.dynamo');

function Dynamo(key, secret){
    Dynamo.super_.call(this, key, secret,
        'dynamodb.us-east-1.amazonaws.com', '2012-08-10');
    this.log = log;
    this.actionQueue = [];
    this.ready = true;
}
util.inherits(Dynamo, Connection);

Dynamo.prototype.signatureVersion = 4;
Dynamo.prototype.name = 'DynamoDB';
Dynamo.prototype.scope = 'dynamodb';
Dynamo.prototype.contentType = 'json';

Dynamo.prototype.action = function(action, data){
    var d = Q.defer();
    if(!this.ready){
        this.actionQueue.push([d, action, data]);
        return d.promise;
    }
    var self = this,
        req = this.request('/');

    req.action(action)
        .json(data)
        .on('retry', function(err){
            self.log.debug('Retrying because of err ' + err);
            self.emit('retry', {
                'error': err,
                'action': action,
                'data': data,
                'id': req.id
            });
        })
        .on('retries exhausted', function(err){
            self.log.debug('Retries exhausted: ' + err);
            self.emit('retries exhausted', {
                'error': err,
                'action': action,
                'data': data,
                'id': req.id
            });
        })
        .on('successful retry', function(err){
            self.log.debug('Retry suceeded after encountering error ' + err);
            self.emit('successful retry', {
                'error': err,
                'action': action,
                'data': data,
                'id': req.id
            });
        })
        .end(function(res){
            var consumed = {};
            if(res.ConsumedCapacityUnits){
                consumed[data.TableName] = res.ConsumedCapacityUnits;
                self.emit('stat', {
                    'consumed': consumed,
                    'action': action,
                    'data': data,
                    'id': req.id
                });
            }
            else if(res.Responses){
                Object.keys(res.Responses).forEach(function(tableName){
                    consumed[tableName] = res.Responses[tableName].ConsumedCapacityUnits;
                });
                self.emit('stat', {
                    'consumed': consumed,
                    'action': action,
                    'data': data,
                    'id': req.id
                });
            }
            return res;
        }).then(function(res){
            d.resolve(res);
        }, function(err){
            d.reject(err);
        });

    return d.promise;
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