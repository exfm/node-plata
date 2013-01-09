"use strict";

var util = require('util'),
    Connection = require('../aws').Connection,
    extend = require('whet.extend');

function CloudWatch(accessKeyId, secretAccessKey){
    CloudWatch.super_.call(this, accessKeyId, secretAccessKey,
        'monitoring.us-east-1.amazonaws.com', '2010-08-01');
}
util.inherits(CloudWatch, Connection);

CloudWatch.prototype.signatureVersion = 2;
CloudWatch.prototype.name = 'CloudWatch';
CloudWatch.prototype.scope = 'cloudwatch';
CloudWatch.prototype.contentType = 'xml';

CloudWatch.prototype.deleteAlarms = function(names){
    var params = {};

    names.forEach(function(name, index){
        params['AlarmNames.member.' + (index + 1)] = name;
    });

    return this.request('/')
        .action('DeleteAlarms')
        .send(params)
        .end();
};

CloudWatch.prototype.describeAlarmHistory = function(name, opts){
    return this.request('/')
        .action('DescribeAlarmHistory')
        .send({'AlarmName': name})
        .end();
};


// Options:
// * actionPrefix - The action name prefix.
// * namePrefix - The alarm name prefix.
// * names
// * max
// * token
// * state
CloudWatch.prototype.describeAlarms = function(opts){
    opts = opts || {};
    var params = {};

    if(opts.actionPrefix){
        params.ActionPrefix = opts.actionPrefix;
    }

    if(opts.namePrefix){
        params.AlarmNamePrefix = opts.namePrefix;
    }

    if(opts.names){
        opts.names.forEach(function(name, index){
            params['AlarmNames.member.' + (index + 1)] = name;
        });
    }

    if(opts.max){
        params.MaxRecords = opts.max;
    }

    if(opts.token){
        params.NextToken = opts.token;
    }

    if(opts.state){
        params.StateValue = opts.state;
    }
    return this.request('/')
        .action('DescribeAlarms')
        .send(params)
        .end();
};


// Options:
// * dimensions: {key, value}
// * statistic: SampleCount | Average | Sum | Minimum | Maximum
// * unit: Seconds | Microseconds | Milliseconds | Bytes | Kilobytes |
//      Megabytes | Gigabytes | Terabytes | Bits | Kilobits | Megabits | Gigabits |
//      Terabits | Percent | Count | Bytes/Second | Kilobytes/Second |
//      Megabytes/Second | Gigabytes/Second | Terabytes/Second | Bits/Second |
//      Kilobits/Second | Megabits/Second | Gigabits/Second | Terabits/Second |
//      Count/Second | None
// * period: The period in seconds over which the statistic is applied.
CloudWatch.prototype.describeAlarmsForMetric = function(namespace, name, opts){
    opts = opts || {};
    var params = {
        'Namespace': namespace,
        'MetricName': name
    };

    if(opts.statistic){
        params.Statistic = opts.statistic;
    }

    if(opts.unit){
        params.Unit = opts.unit;
    }

    if(opts.period){
        params.Period = opts.period;
    }

    if(opts.dimenions){
        Object.keys(opts.dimensions).forEach(function(key, index){
            params['Dimensions.member.' + (index + 1) + '.Name'] = key;
            params['Dimensions.member.' + (index + 1) + '.Value'] = opts.dimensions[key];
        });
    }
    return this.request('/')
        .action('DescribeAlarmsForMetric')
        .send(params)
        .end();
};

CloudWatch.prototype.disableAlaramActions = function(names){
    var params = {};

    names.forEach(function(name, index){
        params['AlarmNames.member.' + (index + 1)] = name;
    });

    return this.request('/')
        .action('DisableAlarmActions')
        .send(params)
        .end();
};

CloudWatch.prototype.enableAlarmActions = function(names){
    var params = {
        'AlarmNames':{
            'member': {}
        }
    };

    names.forEach(function(name, index){
        params['AlarmNames.member.' + (index + 1)] = name;
    });

    return this.request('/')
        .action('EnableAlarmActions')
        .send(params)
        .end();
};

// * statistics: array.  Average | Sum | SampleCount | Maximum | Minimum
CloudWatch.prototype.getMetricStatistics = function(namespace, name, period,
    startTime, endTime, statistics, unit, dimensions){

    var params = {
        'Namespace': namespace,
        'MetricName': name,
        'Period': period,
        'StartTime': startTime,
        'EndTime': endTime,
        'Unit': unit
    };

    statistics.forEach(function(key, index){
        params['Statistics.member.' + (index + 1)] = key;
    });

    if(dimensions){
        var i = 0;
        Object.keys(dimensions).forEach(function(key, index){
            if (dimensions[key] instanceof Array) {
                for (var k=0; k<dimensions[key].length; k++) {
                    params['Dimensions.member.' + (index + i + k + 1) + '.Name'] = key;
                    params['Dimensions.member.' + (index + i + k + 1) + '.Value'] = dimensions[key][k];
                }
                i += dimensions[key].length;
            }
            else {
                params['Dimensions.member.' + (index + i + 1) + '.Name'] = key;
                params['Dimensions.member.' + (index + i + 1) + '.Value'] = dimensions[key];
            }
        });
    }

    return this.request('/')
        .action('GetMetricStatistics')
        .send(params)
        .end();
};

CloudWatch.prototype.listMetrics = function(opts){
    opts = opts || {};
    var params = {};

    if(opts.namespace){
        params.Namespace = opts.namespace;
    }

    if(opts.name){
        params.MetricName = opts.name;
    }

    if(opts.token){
        params.NextToken = opts.token;
    }

    if(opts.dimensions){
        Object.keys(opts.dimensions).forEach(function(key, index){
            params['Dimensions.member.' + (index + 1) + '.Name'] = key;
            params['Dimensions.member.' + (index + 1) + '.Value'] = opts.dimensions[key];
        });
    }

    return this.request('/')
        .action('ListMetrics')
        .send(params)
        .end();
};


var operatorStrings = [
    'GreaterThanOrEqualToThreshold',
    'GreaterThanThreshold',
    'LessThanThreshold',
    'LessThanOrEqualToThreshold'
];

var operatorShortHand = [
    '>=',
    '>',
    '<',
    '<='
];

CloudWatch.prototype.putMetricAlarm = function(namespace, metricName, alarmName,
    comparisonOperator, evaluationPeriod, period, statistic, threshold, opts){

    var params = {
        'Namespace': namespace,
        'MetricName': metricName,
        'AlarmName': alarmName,
        'EvaluationPeriod': evaluationPeriod,
        'Period': period,
        'Statistic': statistic,
        'Threshold': threshold
    };

    if(operatorStrings.indexOf(comparisonOperator) === -1){
        comparisonOperator = operatorStrings[operatorShortHand.indexOf(comparisonOperator)];
    }
    params.ComparisonOperator = comparisonOperator;

    if(opts.actionsEnabled){
        params.ActionsEnabled = opts.actionsEnabled;
    }

    if(opts.alarmActions){
        opts.alaramActions.forEach(function(action, index){
            params['AlaramActions.member.' + (index + 1)] = action;
        });
    }

    if(opts.alarmDescription){
        params.AlarmDescription = opts.alarmDescription;
    }

    if(opts.dimensions){
        Object.keys(opts.dimensions).forEach(function(key, index){
            params['Dimensions.member.' + (index + 1) + '.Name'] = key;
            params['Dimensions.member.' + (index + 1) + '.Value'] = opts.dimensions[key];
        });
    }

    if(opts.insufficientDataActions){
        opts.insufficientDataActions.forEach(function(action, index){
            params['InsufficientDataActions.member.' + (index + 1)] = action;
        });
    }

    if(opts.okActions){
        opts.okActions.forEach(function(action, index){
            params['OKActions.member.' + (index + 1)] = action;
        });
    }

    if(opts.unit){
        params.Unit = opts.unit;
    }

    return this.request('/')
        .action('PutMetricAlarm')
        .send(params)
        .end();
};

CloudWatch.prototype.putMetricData = function(namespace, data){
    var params = {
        'Namespace': namespace
    }, base;

    data.forEach(function(item, index){
        base = 'MetricData.member.' + (index + 1);
        params[base + '.MetricName'] = item.name;
        params[base + '.Unit'] = item.unit;
        params[base + '.Timestamp'] = item.timestamp;
        if (item.value === undefined) {
            params[base + '.StatisticValues.Maximum'] = item.max;
            params[base + '.StatisticValues.Minimum'] = item.min;
            params[base + '.StatisticValues.SampleCount'] = item.samples;
            params[base + '.StatisticValues.Sum'] = item.sum;
        }
        else {
            params[base + '.Value'] = item.value;
        }
        Object.keys(item.dimensions).forEach(function(key, index){
            params[base + '.Dimensions.member.' + (index + 1) + '.Name'] = key;
            params[base + '.Dimensions.member.' + (index + 1) + '.Value'] = item.dimensions[key];
        });
    });

    return this.request('/')
        .action('PutMetricData')
        .send(params)
        .end();
};

CloudWatch.prototype.setAlarmState = function(name, reason, value, reasonData){
    var params = {
        'AlaramName': name,
        'StateReason': reason,
        'StateValue': value
    };

    if(reasonData){
        params.StateReasonData = JSON.stringify(reasonData);
    }

    return this.request('/')
        .action('SetAlarmState')
        .send(params)
        .end();
};

module.exports = CloudWatch;
