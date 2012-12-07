"use strict";

var assert = require('assert'),
    fs = require('fs'),
    common = require('../lib/common');

describe("XML", function(){
    it("should handle list keys properly", function(){
        var xmlString = fs.readFileSync(__dirname + '/xml/s3/list-keys-result.xml').toString('utf-8'),
            xml = common.xmlToObject(xmlString),
            res = xml.listBucketResult;

        assert(res.name === 'bucket');
        assert(res.prefix === null);
        assert(res.marker === null);
        assert(res.maxKeys === 1000);
        assert(res.isTruncated === false);
        assert(res.contents.length === 2);
    });

    it("should not barf on drew's regression case", function(){
        var xmlString = fs.readFileSync(__dirname + '/xml/cloudwatch/get-metric-statistics.xml').toString('utf-8'),
            xml = common.xmlToObject(xmlString),
            res = xml.getMetricStatisticsResponse.getMetricStatisticsResult;

        assert(res.datapoints === null);
        assert(res.label === 'ConsumedWriteCapacityUnits');
    });
});