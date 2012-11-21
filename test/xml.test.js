"use strict";

var assert = require('assert'),
    fs = require('fs'),
    util = require('util'),
    common = require('../lib/common');

var XMLParser = require('xmldom').DOMParser;

describe("XML", function(){
    // it("should work", function(){
    //     var xmlString = '<?xml version="1.0"?><CreateQueueResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><CreateQueueResult><QueueUrl>http://queue.amazonaws.com/160241911954/platatest2</QueueUrl></CreateQueueResult><ResponseMetadata><RequestId>db2820fc-d78a-56ad-8a83-69def687bab9</RequestId></ResponseMetadata></CreateQueueResponse>';
    //     var xml = new XMLParser().parseFromString(xmlString.toString(), "text/xml");
    //     // assert.equal(xml, {});
    //     console.log(xml);
    // });
    it("should handle list keys properly", function(){
        var xmlString = fs.readFileSync(__dirname + '/xml/s3/list-keys-result.xml').toString('utf-8'),
            xml = common.xmlToObject(xmlString);

        console.log(util.inspect(xml, false, 5, true));
        var res = xml.listBucketResult;
        assert(res.name === 'bucket');
        assert(res.prefix === null);
        assert(res.marker === null);
        assert(res.maxKeys === 1000);
        assert(res.isTruncated === false);
        assert(res.contents.length === 2);
    });
});