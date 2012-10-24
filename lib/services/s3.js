"use strict";

var util = require('util'),
  crypto = require('crypto'),
  Connection = require('../aws').Connection,
  when = require('when'),
  https = require('https'),
  common = require('../common'),
  winston = require('winston'),
  querystring = require('querystring');

var log = winston.loggers.get('aws');

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
    503
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
    log.silly('HTTP Request Options: \n' + JSON.stringify(opts, null, 4));

    this.path += "?"+querystring.stringify(params);

    req = https.request(opts, function(res){
        res.setEncoding('binary');
        res.on('data', function(chunk){
            response += chunk;
        });

        res.on('end', function(){
            var result,
                err = null;

            res.body = response;
            log.silly('Response code: ' + res.statusCode);

            if(res.statusCode >= 400){
                if(retryOnCodes.indexOf(res.statusCode) > -1 && retries < 5){
                    // Stop here and retry
                    log.silly('Got code ' + res.statusCode + '.  Retrying in ' + (retries * 100) + 50 + 'ms...');
                    return setTimeout(function(){
                        this.makeRequest(path, verb, headers, cb, body,
                            params, retries + 1).then(function(result, err, req, res){
                                return d.resolve(result, err, req, res);
                            });
                    }.bind(this), (retries * 100) + 50);
                }
                if(response.length > 0){
                    err = new Error(common.xmlToObject(response).error.message);
                }
                else if(res.statusCode === 404){
                    err = new Error(opts.path + " not found");
                }
                else {
                    err = new Error("Unknown error: "+res.statusCode);
                }
                log.error(err, response);
            }
            if(cb){
                result = cb.apply(this, [err, req, res]);
            }
            return d.resolve(result, err, req, res);
        }.bind(this));
    }.bind(this));


    req.on('error', function(e) {
        log.error('Request Error Fired: ', e);
    });

    req.end(body);
    return d.promise;
};

S3.prototype.createBucket = function(bucketName){
    return this.makeRequest(util.format("/%s", bucketName), 'PUT');
};

S3.prototype.deleteBucket = function(bucketName){
    return this.makeRequest(util.format("/%s", bucketName), 'DELETE');
};

S3.prototype.getObject = function(bucketName, key, headers){
    headers = headers || {};
    return this.makeRequest(util.format("/%s/%s", bucketName, key), 'GET', headers,
        function(err, req, res){
            if(res.body.length === 0){
                return null;
            }

            return {
                'content': res.body,
                'etag': res.headers.etag,
                'contentType': res.headers['content-type'],
                'lastModified': new Date(res.headers['last-modified'])
            };
        }
    );
};

S3.prototype.putObject = function(bucketName, key, content, headers){
    headers = headers || {};
    return this.makeRequest(util.format("/%s/%s", bucketName, key), 'PUT',
        headers, undefined, content);
};

S3.prototype.lookup = function(bucketName, key){
    return this.makeRequest(util.format("/%s/%s", bucketName, key), 'HEAD', {},
        function(err, req, res){
            return res.headers;
        }
    );
};

S3.prototype.objectExists = function(bucketName, key){
    return this.makeRequest(util.format("/%s/%s", bucketName, key), 'HEAD', {},
        function(err, req, res){
            return res.statusCode !== 404;
        }
    );
};

S3.prototype.deleteObject = function(bucketName, key){
    return this.makeRequest(util.format("/%s/%s", bucketName, key), 'DELETE', {},
        function(err, req, res){
            return res.headers['x-amz-delete-marker'] === "true";
        }
    );
};

S3.prototype.listBuckets = function(){
    return this.makeRequest("/", 'GET', {},
        function(err, req, res){
            return common.xmlToObject(res.body).listAllMyBucketsResult.buckets;
        }
    );
};

S3.prototype.listKeys = function(bucketName, opts){
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
    return this.makeRequest(util.format("/%s", bucketName), 'GET', {},
        function(err, req, res){
            return common.xmlToObject(res.body).listBucketResult;
        }, '', params
    );

};

module.exports.S3 = S3;