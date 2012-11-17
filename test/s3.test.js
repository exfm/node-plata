"use strict";

var aws = require('../'),
    assert = require('assert');

aws.connect({'file': __dirname + '/auth.json'});

describe("S3", function(){
    describe("bucket", function(){
        it("should create a new bucket");
    });
    describe("key", function(){
        it("should create a new key");
        it("should be able to do HEAD lookups", function(done){
            aws.s3.lookup('exfmnodetest', '1.json').then(function(res){
                done();
            }, done);
        });
        it("should be able to do HEAD lookups for non-existent keys", function(done){
            aws.s3.lookup('exfmnodetest', '2.json').then(function(res){
                done(new Error("Should have been rejected"));
            }, function(){
                done();
            });
        });
        it("should be reject for non-existent keys", function(done){
            aws.s3.exists('exfmnodetest', '2.json').then(function(res){
                done(new Error("Should have been rejected."));
            }, function(){
                done();
            });
        });
    });
});
