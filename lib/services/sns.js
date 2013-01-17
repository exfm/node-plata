"use strict";

var util = require('util'),
    when = require('when'),
    EventEmitter = require('events').EventEmitter,
    aws = require('../aws'),
    Connection = aws.Connection,
    plog = require('plog'),
    log = plog('plata.sns');

plog.all().level('silly');

function SNS(key, secret){
    SNS.super_.call(this, key, secret,
        'sns.us-east-1.amazonaws.com', '2010-03-31');
}
util.inherits(SNS, Connection);

SNS.prototype.signatureVersion = 2;
SNS.prototype.name = 'SNS';
SNS.prototype.contentType = 'xml';

SNS.prototype.addPermission = function(){};

SNS.prototype.createTopic = function(name){
    log.silly('Create topic `'+name+'`...');
    return this.request('/')
        .action('CreateTopic')
        .send({'Name': name})
        .end(function(res){
            res.arn = res.createTopicResponse.createTopicResult.topicArn;
            return res;
        });
};

SNS.prototype.deleteTopic = function(arn){
    return this.request('/')
        .action('DeleteTopic')
        .send({'TopicArn': arn})
        .end(function(res){
            return res;
        });
};

SNS.prototype.getTopicAttributes = function(arn){
    return this.request('/')
        .action('GetTopicAttributes')
        .send({'TopicArn': arn})
        .end(function(res){
            res.attributes = res.getTopicAttributesResponse.getTopicAttributesResult.attributes;
            return res;
        });
};

SNS.prototype.listTopics = function(nextToken){
    var params = {},
        self = this;

    if(nextToken){
        params.NextToken = nextToken;
    }

    return this.request('/')
        .action('ListTopics')
        .send(params)
        .end(function(res){
            res.topics = res.listTopicsResponse.listTopicsResult.topics.member.map(function(t){
                var topic = self.topicFromArn(t.topicArn);
                topic.emit('ready');
                return topic;
            });
            return res;
        });
};


SNS.prototype.publish = function(arn, message, subject, multi){
    var params = {
        'Message': message,
        'TopicArn': arn
    };
    if(subject){
        params.Subject = subject;
    }

    if(multi){
        params.MessageStructure = 'json';
    }
    return this.request('/')
        .action('Publish')
        .send(params)
        .end(function(res){
            return res;
        });
};

SNS.prototype.confirmSubscription = function(arn, token, authOnUnsub){
    authOnUnsub = authOnUnsub || false;
    var self = this,
        params = {
            'Token': token,
            'TopicArn': arn,
            'AuthenticateOnUnSubscribe': (authOnUnsub) ? 'true': 'false'
        };

    return this.request('/')
        .action('ConfirmSubscription')
        .send(params)
        .end(function(res){
            return res;
        });
};

SNS.prototype.setTopicAttributes = function(arn, name, value){
    return this.request('/')
        .action('SetTopicAttributes')
        .send({
            'TopicArn': arn,
            'AttributeName': name,
            'AttributeValue': value
        })
        .end(function(res){
            return res;
        });
};

SNS.prototype.subscribe = function(arn, protocol, endpoint){
    return this.request('/')
        .action('Subscribe')
        .send({
            'TopicArn': arn,
            'Protocol': protocol,
            'Endpoint': endpoint
        })
        .end(function(res){
            res.subscriptionArn = res.subscribeResponse.subscribeResult.subscriptionArn;
            return res;
        });
};

SNS.prototype.unsubscribe = function(subscriptionArn){
    return this.request('/')
        .action('Unsubscribe')
        .send({
            'SubscriptionArn': subscriptionArn
        })
        .end(function(res){
            return res;
        });
};

SNS.prototype.getSubscriptionAttributes = function(subscriptionArn){
    return this.request('/')
        .action('GetSubscriptionAttributes')
        .send({
            'SubscriptionArn': subscriptionArn
        })
        .end(function(res){
            res.attributes = res.getSubscriptionAttributesResponse.getSubscriptionAttributesResult.attributes;
            return res;
        });
};

SNS.prototype.listSubscriptions = function(nextToken){
    var params = {};

    if(nextToken){
        params.NextToken = nextToken;
    }

    return this.request('/')
        .action('ListSubscriptions')
        .send(params)
        .end(function(res){
            var r = res.listSubscriptionsResponse.listSubscriptionsResult.subscriptions;
            res.subscriptions = (r && r.member) ? r.member : [];
            return res;
        });
};

SNS.prototype.listSubscriptionsByTopic = function(arn, nextToken){
    var params = {
        'TopicArn': arn
    };

    if(nextToken){
        params.NextToken = nextToken;
    }

    return this.request('/')
        .action('ListSubscriptionsByTopic')
        .send(params)
        .end(function(res){
            var r = res.listSubscriptionsByTopicResponse.listSubscriptionsByTopicResult.subscriptions;
            res.subscriptions = (r && r.member) ? r.member : [];
            return res;
        });
};

SNS.prototype.setSubscriptionAttributes = function(arn, name, value){
    return this.request('/')
        .action('SetSubscriptionAttributes')
        .send({
            'SubscriptionArn': arn,
            'AttributeName': name,
            'AttributeValue': value
        })
        .end(function(res){
            return res;
        });
};

SNS.prototype.getTopic = function(name){
    var d = when.defer();
    this.listTopics().then(function(res){
        for(var i = 0; i < res.topics.length; i++){
            if(res.topics[i].name === name){
                log.silly('Found topic ' + name);
                return d.resolve(res.topics[i]);
            }
        }
        d.reject(new Error('No topic with name ' + name));
    });
    return d.promise;
};

SNS.prototype.Topic = function(name){
    var topic = new Topic(null, name, this),
        self = this;

    this.getTopic(name).then(function(t){
        log.silly('Get topic returned arn `'+t.arn+'`');
        topic.arn = t.arn;
        topic.emit('ready');
    }, function(err){
        log.silly('Topic doesnt exist.  Going to create it.');
        return self.createTopic(name).then(function(res){
            topic.arn = res.arn;
            topic.emit('ready');
            log.silly('Topic is ready!');
            return topic;
        });
    });
    return topic;
};

SNS.prototype.topicFromArn = function(arn){
    var p = arn.split(':'),
        name = p[(p.length - 1)];

    return new Topic(arn, name, this);
};

function Topic(arn, displayName, connection){
    this.arn = arn;
    this.name = displayName;
    this.connection = connection;
    this.callQueue = [];
    this.ready = (arn) ? true : false;
    this.on('ready', this.processCallQueue.bind(this));
}
util.inherits(Topic, EventEmitter);

Topic.prototype.processCallQueue = function(){
    for(var i = 0; i< this.callQueue.length; i++){
        this[this.callQueue[i][1]].apply(this, this.callQueue[i][2]).then(
            this.callQueue[i][0].resolve, this.callQueue[i][0].reject);
    }
    this.ready = true;
};

Topic.prototype.subscribe = function(protocol, endpoint, authOnUnsub){
    if(!this.ready){
        var d = when.defer();
        log.silly('Topic not ready.  Enqueuing subscribe call.');
        this.callQueue.push([d, 'subscribe', [protocol, endpoint, authOnUnsub]]);
        return d.promise;
    }
    return this.connection.subscribe(this.arn, protocol, endpoint, authOnUnsub);
};

Topic.prototype.unsubscribe = function(subscriptionArn){
    if(!this.ready){
        var d = when.defer();
        log.silly('Topic not ready.  Enqueuing unsubscribe call.');
        this.callQueue.push([d, 'unsubscribe', [subscriptionArn]]);
        return d.promise;
    }
    return this.connection.unsubscribe(subscriptionArn);
};

Topic.prototype.publish = function(message, subject, multi){
    if(!this.ready){
        var d = when.defer();
        this.callQueue.push(d, 'publish', [message, subject, multi]);
        return d.promise;
    }

    if(message === new Object(message)){
        message = JSON.stringify(message);
    }
    return this.connection.publish(this.arn, message, subject, multi);
};

Topic.prototype.confirm = function(token, authOnUnsub){
    if(!this.ready){
        var d = when.defer();
        this.callQueue.push(d, 'confirm', [token, authOnUnsub]);
        return d.promise;
    }

    return this.connection.confirmSubscription(this.arn, token, authOnUnsub);
};

Topic.prototype.getSubscriptions = function(){
    var self = this;

    if(!this.ready){
        var d = when.defer();
        this.callQueue.push(d, 'listSubscriptionsByTopic', []);
        return d.promise;
    }
    return this.connection.listSubscriptionsByTopic(this.arn).then(function(res){
        return res.subscriptions;
    });
};

Topic.prototype.getSubscriptionArn = function(endpoint){
    var d = when.defer();

    this.getSubscriptions().then(function(subs){
        for(var i = 0; i < subs.length; i++){
            if(subs[i].endpoint === endpoint){
                return d.resolve(subs[i].subscriptionArn);
            }
        }
        return d.reject(new Error('No endpoint `'+endpoint+'` subscription for this topic.'));
    }, d.reject);
    return d.promise;
};

// var aws = require('plata').connect({key: '<aws key>', secret: '<aws secret>'}),
//     topic = aws.sns.Topic('bean-factory'),
//     app = require('express')(),
//     myHost = '<some public dns>';

// // First things first.  Well actually second.
// // `aws.sns.Topic` triggers a call to check if the topic already exists.
// // If it doesn't, a new topic will be created automatically.
// // Right.  So hit this URL to start getting notifications from SNS.
// app.post('/subscribe', function(req, res, next){
//     topic.subscribe('http', 'http://' + myHost + ':8080/sns-notification').then(function(){
//         res.send(200, "Subscribe request sent.");
//     });
// });

// // Before SNS will start sending you notifications,
// // you need to have a switch in your route method that blah blah blahs.
// // The middleware will automatically confirm the subscription for you
// // and emit a `confirmed` event.
// topic.on('confirmed', function(notification){
//     console.log('Subscription confirmed', notification);
//     console.log('You can now send messages.');
// });

// // Now let's try and sned a message through SNS
// // that comes back around and hits us.
// app.post('/send-notification', function(req, res, next){
//     topic.publish("Hey buddy", "Optional Subject").then(function(){
//         res.send(200, "Relaying: " + req.param('message'));
//     });
// });

// // Then our callback should get hit.
// // confirming subscription and unsubscription are more or less
// // out of band tasks so the middleware will automatically
// // send back 200's to the SNS agent.
// // In a notification though, you most likely want to be able to control
// // the response, for example automatically sending a retry because a resource
// // is temporarily unavailable, or maybe the topic subscription is no longer
// // valid and you want to unsubscribe.
// app.post('/sns-notification', topic.middleware(), function(req, res, next){
//     console.log("You said: " + req.notification.message);
//     res.send(200);
// });

// // That was fun.  Now let's kill our subscription.
// app.post('/unsubscribe', function(req, res, next){
//     topic.getSubscriptionArn('http://' + myHost + ':8080/sns-notification')
//         .then(function(arn){
//             topic.unsubscribe(arn).then(function(){
//                 res.send(200, "Unubscribe request sent.");
//             });

//         }, function(err){
//             res.send(400, err.message);
//         });
// });

// // If you manually delete the subscription from the console,
// // you'll get this event.  If you call topic.unsubscribe directly,
// // this event will not be fired.
// topic.on('unsubscribe', function(notification){
//     console.log('Unsubscription Confirmation', notification);
// });

// app.listen(8080);
Topic.prototype.middleware = function(req, res, next){
    var types = [
            'SubscriptionConfirmation',
            'UnsubscribeConfirmation',
            'Notification'
        ],
        self = this,
        notification;

    return function(req, res, next){
        var type = req.headers['x-amz-sns-message-type'];

        req.notification = null;

        if(!type){
            return next();
        }
        if(types.indexOf(type) === -1){
            return next(new Error('Unknown notification ' + type));
        }

        // Not ours.
        if(req.headers['x-amz-sns-topic-arn'] !== self.arn){
            return next(new Error('Wrong topic ARN: ' + req.headers['x-amz-sns-topic-arn']));
        }

        if (req._body){
            return next();
        }

        req._body = true;

        var buf = '';
        req.setEncoding('utf8');
        req.on('data', function(chunk){ buf += chunk;});
        req.on('end', function(){
            try {
                req.body = JSON.parse(buf);
                req.notification = new Notification(req.body, self);
                self.lastSubscriptionArn = req.subscriptionArn = req.headers['x-amz-sns-subscription-arn'];

                if(type === 'SubscriptionConfirmation'){
                    self.confirm(req.notification.token).then(function(){
                        self.emit('confirmed', req.notification);
                        return res.send(200, 'OK');
                    });
                }
                else if(type === 'UnsubscribeConfirmation'){
                    self.emit('unsubscribe', req.notification);
                    return res.send(200, 'OK');
                }
                else if(type === 'Notification'){
                    self.emit('notification', req.notification);
                    next();
                }
            } catch (err){
              err.body = buf;
              err.status = 400;
              next(err);
            }
        });
    };
};

function Notification(data, topic){
    this.topic = topic;
    this.type = data.Type;
    this.id = data.MessageId;
    try{
        this.message = JSON.parse(data.Message);
    }
    catch(e){
        this.message = data.Message;
    }
    this.subject = data.Subject;
    this.timestamp = new Date(data.Timestamp);
    this.token = data.Token;
}

module.exports = SNS;