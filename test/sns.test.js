"use strict";

var aws = require('../'),
    assert = require('assert'),
    util = require('util');

aws.connect({'file': __dirname + '/auth.json'});

describe("SNS", function(){
    // it("should create a topic", function(done){
    //     var name = 'platatest';
    //     aws.sns.createTopic(name).then(function(res){
    //         // console.log('Topic ARN: ', res.arn);
    //         aws.sns.deleteTopic(res.arn).then(function(res){
    //             done();
    //         });
    //     }, done);
    // });
    // it("should subscribe", function(done){
    //     var name = 'platatest',
    //         topic,
    //         sub;

    //     aws.sns.createTopic(name).then(function(res){
    //         topic = res.arn;
    //         return res;
    //     }).then(function(){
    //         return aws.sns.subscribe(topic, 'sqs', 'arn:aws:sqs:us-east-1:160241911954:platatest');
    //     }).then(function(res){
    //         console.log('Subscription Arn: ', res.subscriptionArn);
    //         // return aws.sns.deleteTopic(topic);
    //         done();
    //     }).then(function(res){
    //         done();
    //     });
    // });
    it("should list topics", function(done){
        aws.sns.listTopics().then(function(res){
            console.log('Topics', util.inspect(res.topics, false, 5, false));
            done();
        });
    });
});