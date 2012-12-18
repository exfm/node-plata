"use strict";

var fs = require('fs'),
    cloudsearch = require('./lib/services/cloud-search'),
    s3 = require('./lib/services/s3'),
    ses = require('./lib/services/ses'),
    sqs = require('./lib/services/sqs'),
    SNS = require('./lib/services/sns'),
    STS = require('./lib/services/sts'),
    Dynamo = require('./lib/services/dynamo'),
    ec2 = require('./lib/services/ec2'),
    CloudWatch = require('./lib/services/cloud-watch'),
    log = require('./lib/aws').log,
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    log = require('./lib/aws').log;

function AWS(){
    AWS.super_.call(this);
    this.setMaxListeners(0);
    this.connected = false;
}
util.inherits(AWS, EventEmitter);

AWS.prototype.connect = function(opts){
    if(this.connected){
        return this;
    }
    opts = opts || {};

    var key = opts.key || process.env.AWS_KEY,
        secret = opts.secret || process.env.AWS_SECRET,
        data;

    if(opts.file){
        data = JSON.parse(fs.readFileSync(opts.file));
        key = data.key;
        secret = data.secret;
    }

    this.accessKeyId = key;
    this.secretAccessKey = secret;

    Object.defineProperty(this, "s3", { get : function(){
        return new s3.S3(key, secret);
    }});

    Object.defineProperty(this, "ec2", { get : function(){
        return new ec2.EC2(key, secret);
    }});

    this.ses = new ses.SES(key, secret);

    Object.defineProperty(this, "sqs", { get : function(){
        return new sqs.SQS(key, secret);
    }});

    Object.defineProperty(this, "sts", { get : function(){
        return new STS(key, secret);
    }});

    this.dynamo = new Dynamo(key, secret);

    this.cloudSearch = new cloudsearch.CloudSearch(key, secret);
    this.cloudWatch = new CloudWatch(key, secret);
    this.sns = new SNS(key, secret);

    this.emit('connect');
    this.connected = true;
    return this;
};

AWS.prototype.onConnected = function(cb){
    if(this.connected){
        return cb.apply(this, []);
    }
    this.on('connect', cb);
};

AWS.prototype.setLogLevel = function(level){
    log.transports.console.level = level;
};

module.exports = new AWS();
module.exports.log = log;
