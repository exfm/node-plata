"use strict";

var aws = require('../'),
    assert = require('assert'),
    util = require('util');

aws.connect({'file': __dirname + '/auth.json'});

describe("Dynamo", function(){
    it("should list tables", function(done){
        aws.dynamo.listTables().then(function(res){
            console.log('Result from list tables', res);
            done();
        }, done);
    });

    it("should get things", function(done){
        var req = {
            'TableName': 'Song',
                'Key': {
                    'HashKeyElement': {
                        'N': '123456789'
                    }
                }
            };
        aws.dynamo.on('stat', function(data){
            console.log('Action ' + data.action + ' consumed ' + data.consumed + ' capacity units!!!!');
        });
        aws.dynamo.getItem(req).then(function(data){
            done();
        }, done);
    });
});