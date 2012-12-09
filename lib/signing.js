"use strict";

var common = require('./common'),
    crypto = require('crypto'),
    querystring = require('querystring'),
    plog = require('plog');

module.exports.V4 = function V4Signature(request, creds, timestamp){
    timestamp = timestamp || new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    var authorization = [],
        signature,
        canonical,
        stringToSign,
        sortedHeadersString,
        log = plog('plata.signing.v4');

    function hmac(secret, what, encoding){
        encoding = encoding || 'binary';
        return crypto.createHmac('sha256', secret).update(what).digest(encoding);
    }

    request.headers['user-agent'] = 'node-plata/0.1; http://github.com/exfm/node-plata';
    request.headers.host = request.host.toLowerCase();
    request.headers.date = request.headers['x-amz-date'] = timestamp;
    request.headers['content-length'] = request.body.length;

    if(creds.sessionToken){
        request.headers['x-amz-security-token'] = creds.sessionToken;
    }

    // Create the credential string for this request.
    var credentialString = [
            creds.key,
            timestamp.substr(0, 8),
            request.region,
            request.scope,
            'aws4_request'
        ].join('/');
    log.silly('Credential String: ' + credentialString);

    authorization.push('AWS4-HMAC-SHA256 Credential=' +credentialString);

    // Create signed headers, which is weird because they're not signed at
    // all, just sorted.  Meh.
    sortedHeadersString = Object.keys(request.headers).map(function(name){
            return name.toLowerCase();
        }).sort().join(';');

    log.silly('SignedHeaders String: ' + sortedHeadersString);
    authorization.push('SignedHeaders=' + sortedHeadersString);


    // Now the tricky bit... Create the actual signature
    canonical = [
        request.method,
        request.path,
        request.path.split('?', 2)[1] || '',
        common.cannonicalizeHeaders(request.headers, false, true),
        '',
        sortedHeadersString,
        crypto.createHash('sha256').update(request.body).digest('hex')
    ].join('\n');

    request.canonical = canonical;
    log.silly('Canonical String (correct): ' + JSON.stringify(canonical));
    log.silly('Canonical hash: ' + crypto.createHash('sha256').update(canonical).digest('hex').toLowerCase());
    log.silly('Hex encode ' + canonical + ' is ' + crypto.createHash('sha256').update(canonical).digest('hex').toLowerCase());

    stringToSign = [
        'AWS4-HMAC-SHA256',
        timestamp,
        credentialString.replace(creds.key + '/', ''),
        crypto.createHash('sha256').update(canonical).digest('hex').toLowerCase()
        ].join('\n');

    log.silly('String to Sign (correct): ' + stringToSign);
    request.stringToSign = stringToSign;

    var sd = hmac('AWS4' + creds.secret, timestamp.substr(0, 8));
    log.silly('HMAC 1: ' + sd);

    var sr = hmac(sd, request.region);
    log.silly('HMAC 2: ' + sr);


    var ss = hmac(sr, request.scope);
    log.silly('HMAC 3: ' + ss);

    var sk = hmac(ss, 'aws4_request');
    log.silly('HMAC 4: ' + sk);


    signature = hmac(sk, stringToSign, 'hex').toLowerCase();
    log.silly('Signature: ' + signature);

    authorization.push('Signature=' + signature);
    request.signature = signature;

    request.headers.authorization = authorization.join(', ');
    return request;
};

module.exports.V2 = function V2Signature(request, creds){
    request.params.AWSAccessKeyId = creds.key;
    request.params.SignatureVersion = 2;
    request.params.SignatureMethod = 'HmacSHA256';
    request.params.Timestamp = new Date().toISOString().replace(/\.[0-9]{0,3}Z$/, 'Z');

    var stringToSign = [
            request.method,
            request.host.toLowerCase(),
            request.path,
            querystring.stringify(common.sortObjectByKeys(request.params))
        ].join("\n"),
        signature = crypto.createHmac('sha256', creds.secret)
            .update(stringToSign)
            .digest('base64');

    request.params.Signature = signature;
    return request;
};