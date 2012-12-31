"use strict";

var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    Connection = require('../aws').Connection,
    plog = require('plog'),
    log = plog('plata.sts').level('silly');

function STS(accessKeyId, secretAccessKey){
    STS.super_.call(this, accessKeyId, secretAccessKey,
        'sts.amazonaws.com', '2011-06-15');
    this.log = log;
}
util.inherits(STS, Connection);
STS.prototype.signatureVersion = 2;
STS.prototype.name = 'STS';
STS.prototype.scope = 'sts';
STS.prototype.contentType = 'xml';

STS.prototype.getSessionToken = function(duration){
    this.log.debug('Trying to get new session token for `'+duration+'` seconds...');

    var params = {
        'DurationSeconds': duration
    }, self = this;

    return this.request('/')
        .action('GetSessionToken')
        .send(params)
        .end(function(res){
            res.token = res.getSessionTokenResponse.getSessionTokenResult.credentials;
            return res;
        });
};

STS.prototype.Session = function(duration){
    var session = new Session(this, duration),
        self = this;

    this.getSessionToken(duration).then(function(creds){
        session.addCredentials(creds);

        session.emit('ready', session);
    }, function(err){
        throw err;
    });
    return session;
};

function Session(connection, duration){
    this.refreshInterval = undefined;
    this.duration = duration;
    this.refreshTime = (this.duration - 60) * 1000;

    this.connection = connection;
    this.on('ready', this.addRefresher.bind(this));
}
util.inherits(Session, EventEmitter);

Session.prototype.addCredentials = function(creds){
    this.expiration = creds.expiration;
    this.key = this.accessKeyId = creds.accessKeyId;
    this.secret = this.secretAccessKey = creds.secretAccessKey;
    this.sessionToken = creds.sessionToken;
};

Session.prototype.addRefresher = function(){
    clearInterval(this.refreshInterval);
    // Refresh one minute before expiration
    this.refreshInterval = setInterval(this.refresh.bind(this), this.refreshTime);
};

Session.prototype.refresh = function(){
    var self = this;
    this.connection.getSessionToken(this.duration).then(function(creds){
        self.addCredentials(creds);
        self.emit('refresh');
    }, function(err){
        throw err;
    });
};

Session.prototype.close = function(){
    clearInterval(this.refreshInterval);
};

module.exports = STS;
module.exports.Session = Session;