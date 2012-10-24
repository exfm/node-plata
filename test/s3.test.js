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
            aws.s3.lookup('exfmnodetest', '1.json').then(function(headers){
                done();
            });
        });
        it("should be able to do HEAD lookups for non-existent keys", function(done){
            aws.s3.lookup('exfmnodetest', '2.json').then(function(headers){
                done();
            });
        });
        it("should be return false for non-existent keys", function(done){
            aws.s3.objectExists('exfmnodetest', '2.json').then(function(exists){
                assert.equal(exists, false);
                done();
            });
        });
    });

});

// sequence(aws).then(
//     function(next){
//         aws.s3.createBucket('exfmnodetest').then(
//             function(r){
//                 next();
//             },
//             function(err){
//                 console.error(err);
//             }
//         );
//     }).then(
//     function(next){
//         aws.s3.putObject('exfmnodetest', '1.json', JSON.stringify({'hello': 'world'})).then(
//             function(r){
//                 console.log(r);
//                 next();
//             },
//             function(err){
//                 console.error(err);
//             }
//         );
//     }).then(
//     function(next){
//         aws.s3.listKeys('exfmnodetest').then(
//             function(r){
//                 console.log(r);
//             },
//             function(err){
//                 console.error(err);
//             }
//         );
//     });

