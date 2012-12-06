"use strict";

var https = require('https'),
  querystring = require('querystring'),
  crypto = require('crypto'),
  util = require('util'),
  winston = require('winston'),
  common = require('./common'),
  when = require('when');

var log = winston.loggers.add('aws', {
    console: {
        'level': 'silly',
        'timestamp': false,
        'colorize': true
    }
});

var log = module.exports.log = winston.loggers.get('aws');

var retryCodes = [
    'SignatureDoesNotMatch'
];
function ClientError(code, message){
    this.code = code;
    this.message = message;
    ClientError.super_.call(this, message);
}
util.inherits(ClientError, Error);

ClientError.prototype.canRetry = function(){
    return retryCodes.indexOf(this.code) > -1;
};

function Connection(accessKeyId, secretAccessKey, host, version){
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.host = host;
    this.version = version;
    this.autoParseResponse = true;
    this.path = '/';
}

Connection.prototype.getSignature = function(verb, params, headers){
    var str, hmac;
    str = [
        verb,
        this.host.toLowerCase(),
        this.path,
        querystring.stringify(common.sortObjectByKeys(params))
    ].join("\n");
    log.silly('string to sign: '+str);

    hmac = crypto.createHmac('sha1', this.secretAccessKey);
    return hmac.update(str).digest('base64');
};

var retryOnCodes = [
    500,
    503,
    505,
    400,
    403
];

Connection.prototype.makeRequest = function(cb, action, params, verb, headers, path, retries){
    verb = verb || 'GET';
    params = params || {};
    path = path || '/';
    headers = headers || {};
    retries = retries || 0;

    log.info('make request', {'host': this.host, 'action': action, 'params': params, 'verb': verb, 'headers': headers, 'path': path});


    var d = when.defer(),
        response = '',
        paramString = '',
        opts, req;

    // Set baked params
    params.Action = action;
    params.AWSAccessKeyId = this.accessKeyId;
    params.Version = this.version;
    params.SignatureVersion = 2;
    params.SignatureMethod = 'HmacSHA1';
    params.Timestamp = new Date().toISOString().replace(/\.[0-9]{0,3}Z$/, 'Z');

    // Set up our request
    opts = {
        'host': this.host,
        'path': this.path,
        'headers': {},
        'method': verb
    };

    // If it's a post, be nice and add content type and content length
    if(verb === 'POST'){
        opts.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8';
        opts.headers['Content-Length'] = paramString.length;
    }

    // Copy in optional headers
    Object.keys(headers).forEach(function(key){
        opts.headers[key] = headers[key];
    });

    // Generate Signature param
    params.Signature = this.getSignature(verb, params, opts.headers);
    params = common.sortObjectByKeys(params);

    // Generate param string (same as body for posts)
    paramString = querystring.stringify(params);

    opts.path += '?'+paramString;
    log.silly('request options', opts);
    log.silly('params', params);


    req = https.request(opts, function(res){
        res.on('data', function(chunk){
            response += chunk;
        });
        res.on('end', function(){
            var result = response,
                self = this,
                err;

            log.silly(response);
            log.silly('response headers', res.headers);
            result = common.xmlToObject(response);


            if(res.statusCode >= 400){
                if(result.hasOwnProperty('errorResponse')){
                    log.error(result.errorResponse.error.message);
                    err = new ClientError(result.errorResponse.error.code,
                        result.errorResponse.error.message);

                    if(err.canRetry() && retries < 5){
                        log.silly('Going to retry...');
                        return setTimeout(function(){
                                self.makeRequest(cb, action, params, verb, headers,
                                    path, retries + 1).then(d.resolve, d.reject);
                            }, Number((retries * 100) + 50));
                    }
                    else {
                        return d.reject(err);
                    }
                }

            }
            result = cb(result);
            return d.resolve(result);
        }.bind(this));
    }.bind(this));

    req.on('error', function(e) {
        d.reject(e);
    });

    req.end((verb === 'POST' ? paramString : ''));
    return d.promise;
};

module.exports.Connection = Connection;
module.exports.log = log;
