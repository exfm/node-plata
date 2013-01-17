"use strict";

var aws = require('../../').connect({key: '<your key>', secret: '<your secret>'}),
    topic = aws.sns.Topic('beanfactory'),
    app = require('express')(),
    myHost = 'lucas-dev.ex.fm';

// First things first.  Well actually second.
// `aws.sns.Topic` triggers a call to check if the topic already exists.
// If it doesn't, a new topic will be created automatically.
// Right.  So hit this URL to start getting notifications from SNS.
app.post('/subscribe', function(req, res, next){
    topic.subscribe('http', 'http://' + myHost + ':8080/sns-notification').then(function(){
        res.send(200, "Subscribe request sent.");
    });
});

// Before SNS will start sending you notifications,
// you need to have a switch in your route method that blah blah blahs.
// The middleware will automatically confirm the subscription for you
// and emit a `confirmed` event.
topic.on('confirmed', function(notification){
    console.log('Subscription confirmed', notification);
    console.log('You can now send messages.');
});

// Now let's try and sned a message through SNS
// that comes back around and hits us.
app.post('/send-notification', function(req, res, next){
    topic.publish("Hey buddy", "Optional Subject").then(function(){
        res.send(200, "Relaying: " + req.param('message'));
    });
});

// Then our callback should get hit.
// confirming subscription and unsubscription are more or less
// out of band tasks so the middleware will automatically
// send back 200's to the SNS agent.
// In a notification though, you most likely want to be able to control
// the response, for example automatically sending a retry because a resource
// is temporarily unavailable, or maybe the topic subscription is no longer
// valid and you want to unsubscribe.
app.post('/sns-notification', topic.middleware(), function(req, res, next){
    console.log("You said: " + req.notification.message);
    res.send(200);
});

// That was fun.  Now let's kill our subscription.
app.post('/unsubscribe', function(req, res, next){
    topic.getSubscriptionArn('http://' + myHost + ':8080/sns-notification')
        .then(function(arn){
            topic.unsubscribe(arn).then(function(){
                res.send(200, "Unubscribe request sent.");
            });

        }, function(err){
            res.send(400, err.message);
        });
});

// If you manually delete the subscription from the console,
// you'll get this event.  If you call topic.unsubscribe directly,
// this event will not be fired.
topic.on('unsubscribe', function(notification){
    console.log('Unsubscription Confirmation', notification);
});

app.listen(8080);