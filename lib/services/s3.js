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

var log = winston.loggers.get('aws'),
    pendingRetries = [];

function S3(accessKeyId, secretAccessKey){
    S3.super_.call(this, accessKeyId, secretAccessKey,
        's3.amazonaws.com', '2006-03-01');
    this.autoParseResponse = false;
}

util.inherits(S3, Connection);

S3.prototype.getSignature = function(verb, path, headers){
    var strToSign, amzHeaders = {}, val, hmac, headerValues;
    Object.keys(headers).forEach(function(key){
        if (key.toLowerCase().indexOf('x-amz-') > -1) {
            val = headers[key].replace(/[\r\n]/g, ' ');
            key = key.toLowerCase();
            amzHeaders[key] = util.format("%s:%s", key, val);
        }
    });
    amzHeaders = common.sortObjectByKeys(amzHeaders);
    headerValues = Object.keys(amzHeaders).map(function(k){
        return amzHeaders[k];
    });

    strToSign = [
        verb,
        (headers['Content-MD5'] || ''),
        (headers['Content-Type'] || ''),
        headers.Date
    ];

    if(headerValues.length > 0){
        strToSign.push(headerValues.join("\n"));
    }
    strToSign.push(path);
    strToSign = strToSign.join("\n");
    hmac = crypto.createHmac('sha1', this.secretAccessKey);
    return hmac.update(strToSign).digest('base64');
};

var retryOnCodes = [
    500,
    503,
    505,
    400,
    403
];

S3.prototype.makeRequest = function(path, verb, headers, cb, body, params, retries){
    verb = verb || 'GET',
    path = path || '/',
    headers = headers || {},
    body = body || '',
    params = params || {},
    retries = retries || 0;

    var d = when.defer(),
        response = '',
        paramString = '',
        req,
        opts = {
            'host': this.host,
            'path': path,
            'headers': {},
            'method': verb
        };

    opts.headers['Content-Length'] = body.length;

    opts.headers.Date = new Date().toUTCString();

    // Copy in optional headers
    Object.keys(headers).forEach(function(key){
        opts.headers[key] = headers[key];
    });

    opts.headers.Authorization = util.format("AWS %s:%s", this.accessKeyId,
        this.getSignature(verb, path, opts.headers));

    log.silly('Making request for ' + opts.path + '...');
    log.silly(opts.path + ' Options: \n' + JSON.stringify(opts, null, 4));

    this.path += "?"+querystring.stringify(params);

    req = https.request(opts, function(res){
        res.setEncoding('binary');
        res.on('data', function(chunk){
            response += chunk;
        });

        res.on('end', function(){
            var r,
                message,
                err = null;

            res.body = response;
            if(res.statusCode >= 400){
                if(retryOnCodes.indexOf(res.statusCode) > -1 && retries < 5){
                    // Stop here and retry
                    log.silly('Got code ' + res.statusCode + '.  Retrying in ' + Number((retries * 100) + 50) + 'ms...');
                    pendingRetries.push(opts.path);
                    return setTimeout(function(){
                        this.makeRequest(path, verb, headers, cb, body,
                            params, retries + 1).then(function(result, err, req, res){
                                pendingRetries.pop(pendingRetries.indexOf(opts.path));
                                return d.resolve(result, err, req, res);
                            });
                    }.bind(this), Number((retries * 100) + 50));
                }
                if(response.length > 0){
                    r = common.xmlToObject(response);
                    message = r.xml ? r.xml.message : r.error.message;
                    err = new Error(message);
                }
                else if(res.statusCode === 404){
                    err = new Error(opts.path + " not found");
                }
                else {
                    err = new Error("Unknown error: "+res.statusCode + ", Body: " + res.body + ", Path: " + opts.path);
                }
                return d.reject(err);
            }
            if(cb){
                cb.apply(this, [res, req]);
            }
            d.resolve(res);
        }.bind(this));
    }.bind(this));


    req.on('error', function(e) {
        log.error('Request Error Fired: ' + opts.path +  JSON.stringify(e, null, 4));
    });

    req.end(body);
    return d.promise;
};

S3.prototype.createBucket = function(name){
    return this.makeRequest('/' + name, 'PUT');
};

S3.prototype.removeBucket = function(name){
    return this.makeRequest('/' + name, 'DELETE');
};

S3.prototype.get = function(bucket, key, headers){
    return this.makeRequest('/'+bucket+'/'+ key, 'GET', headers);
};

S3.prototype.put = function(bucket, key, content, headers){
    headers = headers || {};
    return this.makeRequest('/'+bucket+'/'+ key, 'PUT',
        headers, undefined, content);
};

S3.prototype.lookup = function(bucket, key){
    return this.makeRequest(util.format("/%s/%s", bucket, key), 'HEAD', {});
};

S3.prototype.exists = function(bucket, key){
    return this.makeRequest(util.format("/%s/%s", bucket, key), 'HEAD', {},
        function(res, req){
            res.exists = (res.statusCode !== 404);
        }
    );
};

S3.prototype.remove = function(bucketName, key){
    return this.makeRequest('/'+bucketName+'/'+key, 'DELETE', {},
        function(res, req){
            res.success = (res.headers['x-amz-delete-marker'] === "true");
        }
    );
};

S3.prototype.getBuckets = function(){
    return this.makeRequest("/", 'GET', {},
        function(res, req){
            res.buckets = common.xmlToObject(res.body).listAllMyBucketsResult.buckets;
        }
    );
};

S3.prototype.getKeys = function(bucketName, opts){
    opts = opts || {};
    var params = {},
        optMap = {
            'prefix': 'prefix',
            'delimiter': 'delimiter',
            'maxKeys': 'max-keys',
            'marker': 'marker'
        };
    Object.keys(optMap).forEach(function(key){
        if(opts.hasOwnProperty(key)){
            params[optMap[key]] = opts[key];
        }
    });
    return this.makeRequest('/'+bucketName, 'GET', {},
        function(res, req){
            res.keys = common.xmlToObject(res.body).listBucketResult;
        }, '', params
    );
};

module.exports.S3 = S3;