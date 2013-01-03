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
        'ec2.amazonaws.com', '2012-12-01');
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

function addListParam(params, base, values){
    values.forEach(function(val, index){
        params[base + '.' + (index + 1)] = val;
    });
}

function addFilterParams(params, filters){
    Object.keys(filters).forEach(function(name, index){
        var awsName = name,
            value = filters[name];

        if(!awsName.indexOf('tag:')){
            awsName = awsName.replace('_', '-');
        }

        params['Filter.'+ (index + 1) +'.Name'] = awsName;

        if(!Array.isArray(value)){
            value = [value];
        }
        value.forEach(function(val, valueIndex){
            params['Filter.'+ (index + 1) +'.Value.' + (valueIndex + 1)] = val;
        });
   });
}

// > dashedToCamel('private-dns-name')
// 'privateDnsName'
function dashedToCamel(s){
    return s.replace(/\-([a-z]{1})/g, function(){
        return arguments[1].toUpperCase();
    });
}
// > camelToDashed('privateDnsName')
// 'private-dns-name'
function camelToDashed(s){
    return s.replace(/([A-Z]{1})/g, function(){
        return '-' + arguments[1].toLowerCase();
    });
}

EC2.prototype.describeInstances = function(opts){
    opts = opts || {};
    var params = {},
        self = this;

    if(opts.id){
        opts.ids = [opts.id];
        delete opts.id;
    }

    if(opts.ids){
        addListParam(params, 'InstanceId', opts.ids);
        delete opts.ids;
    }

    addFilterParams(params, opts);

    return this.request('/')
        .action('DescribeInstances')
        .send(params)
        .end(function(res){
            res.reservations = res.describeInstancesResponse.reservationSet.item.map(function(data){
                return new Reservation(data, self);
            });
            res.instances = [];
            res.reservations.forEach(function(reservation){
                reservation.instances.forEach(function(instance){
                    res.instances.push(instance);
                });
            });
            return res;
        });
};

// Create tags for an EC2 resource.
//
// resourcesWithTags - Map of resource id => {tag key: tag value}.
//
// Example:
// aws.ec2.createTags({'instanceid': {'purpose': 'jelly bean maker'}});
EC2.prototype.createTags = function(resourcesWithTags){
    var params = {},
        index = 1;
    Object.keys(resourcesWithTags).forEach(function(resource){
        Object.keys(resourcesWithTags[resource]).forEach(function(key){
            params['ResourceId.'+ (index)] = resource;
            params['Tag.'+ (index) + '.Key'] = key;
            params['Tag.'+ (index) + '.Value'] = resourcesWithTags[resource][key];
            index++;
        });
    });

    return this.request('/')
        .action('CreateTags')
        .send(params)
        .end();
};

// Delete tags for an EC2 resource
//
// resourcesWithTags - Map of resource id => {tag key: tag value} for doing
//     a value dependent delete or  resource id => [tag key] to just remove the
//     tag regardless of value.
//
// Examples:
// aws.ec2.deleteTags({'instanceid': {'purpose': 'jelly bean maker'}});
//
// aws.ec2.deleteTags({'instanceid': ['purpose']});
EC2.prototype.deleteTags = function(resourcesWithTags){
    var params = {},
        index = 1;
    Object.keys(resourcesWithTags).forEach(function(resource){
        if(Array.isArray(resourcesWithTags[resource])){
            resourcesWithTags[resource].forEach(function(key){
                resourcesWithTags[resource][key] = null;
            });
        }
        Object.keys(resourcesWithTags[resource]).forEach(function(key){
            params['ResourceId.'+ index] = resource;
            params['Tag.'+ index  + '.Key'] = key;
            if(resourcesWithTags[resource][key]){
                params['Tag.'+ index + '.Value'] = resourcesWithTags[resource][key];
            }
            index++;
        });
    });

    return this.request('/')
        .action('DeleteTags')
        .send(params)
        .end();
};

function Reservation(data, connection){
    this.reservationId = data.reservationid;
    this.ownerId = data.ownerId;
    this.groups = data.groupSet.item;
    this.instances = data.instancesSet.item.map(function(i){
        return new Instance(i, connection);
    });
    this.requesterId = data.requesterId;
}

function Instance(data, connection){
    var self = this;
    this.connection = connection;
    Object.keys(data).forEach(function(k){
        self[k] = data[k];
    });
    this.id = data.instanceId;

    this.devices = {};
    if(this.blockDeviceMapping){
        this.blockDeviceMapping.item.forEach(function(item){
            self.devices[item.deviceName] = item.ebs;
        });
    }
    this.tags = {};
    this.tagList = [];
    if(this.tagSet){
        this.tagSet.item.forEach(function(item){
            self.tags[item.key] = item.value;
            self.tagList.push([item.key, item.value]);
        });
    }
    this.az = this.placement.availabilityZone;

    delete this.tagSet;
    delete this.blockDeviceMapping;
}

Instance.prototype.toString = function(){
    return 'Instance(id="'+this.id+'", az="'+this.az+'", tags="'+this.tagList.map(function(i){return i[0]+ "=" + i[1];})+'")';
};

module.exports = EC2;