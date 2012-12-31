"use strict";

var util = require('util'),
    crypto = require('crypto'),
    Connection = require('../aws').Connection,
    log = require('../aws').log,
    when = require('when'),
    https = require('https'),
    common = require('../common'),
    winston = require('winston'),
    querystring = require('querystring');

function EC2(accessKeyId, secretAccessKey){
    EC2.super_.call(this, accessKeyId, secretAccessKey,
        'ec2.amazonaws.com', '2011-12-15');
}
util.inherits(EC2, Connection);

EC2.prototype.signatureVersion = 2;
EC2.prototype.name = 'EC2';
EC2.prototype.scope = 'ec2';
EC2.prototype.contentType = 'xml';

EC2.prototype.describeAvailabilityZones = function(){
    return this.request('/')
        .action('DescribeAvailabilityZones')
        .end();
};

EC2.prototype.describeRegions = function(){
    return this.request('/')
        .action('DescribeRegions')
        .end();
};

EC2.prototype.describeInstances = function(){
    return this.request('/')
        .action('DescribeInstances')
        .end();
};

module.exports = EC2;