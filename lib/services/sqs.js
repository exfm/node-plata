"use strict";

var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    common = require('../common'),
    Connection = require('../aws').Connection,
    when = require('when'),
    parseUrl = require('url').parse;

function SQS(accessKeyId, secretAccessKey){
    SQS.super_.call(this, accessKeyId, secretAccessKey,
        'queue.amazonaws.com', '2012-11-05');
}
util.inherits(SQS, Connection);

SQS.prototype.queueFromUrl = function(url){
    return Queue.fromUrl(url, this);
};

SQS.prototype.getQueue = function(name){
    var d = when.defer(),
        self = this;

    this.getQueueUrl({'name': name}).then(function(url){
        d.resolve(self.queueFromUrl(url));
    }, d.reject);
    return d.promise;
};

SQS.prototype.createQueue = function(name, attributes) {
    var params = {'QueueName': name},
        self = this;

    if(attributes){
        Object.keys(attributes).forEach(function(name, index){
            var val = attributes[name];
            if(name === 'policy'){
                val = JSON.stringify(val);
            }
            params['Attribute.'+ (index + 1) +'.Name'] = common.toTitleCase(name);
            params['Attribute.'+ (index + 1) +'.Value'] = val;
        });
    }
    return this.makeRequest(function(response){
        return self.queueFromUrl(response.createQueueResponse.createQueueResult[0]);
    }, 'CreateQueue', params);
};

SQS.prototype.deleteQueue = function(url, name){
    var queryUrl = parseUrl(url);

    this.host = queryUrl.host;
    this.path = queryUrl.pathname;

    return this.makeRequest(function(response){
        return response;
    }, 'DeleteQueue', {'QueueName': name});
};

SQS.prototype.listQueues = function(prefix){
    var params = {},
        self = this;

    if(prefix){
        params.QueueNamePrefix = prefix;
    }
    return this.makeRequest(function(response){
        var res = response.listQueuesResponse.listQueuesResult;

        if(!Array.isArray(res)){
            res = [res];
        }

        return res.map(function(queueUrl){
            return self.queueFromUrl(queueUrl);
        });
    }, 'ListQueues', params);
};

SQS.prototype.getQueueUrl = function(opts) {
    var params = {},
        self = this;
    opts =  opts || {};

    if(opts.name){
        params.QueueName = opts.name;
    }
    if(opts.ownerId){
        params.QueueOwnerAWSAccountId = opts.ownerId;
    }

    return this.makeRequest(function(response){
        if(params.QueueName){
            return response.getQueueUrlResponse.getQueueUrlResult[0];
        }
        return response;
    }, 'GetQueueUrl', params);
};


// @todo (lucas) Re-write these in the response to be more terse?
var numberFields = [
    'approximateNumberOfMessages',
    'approximateNumberOfMessagesNotVisible',
    'approximateNumberOfMessagesDelayed',
    'visibilityTimeout',
    'maximumMessageSize',
    'messageRetentionPeriod',
    'delaySeconds',
    'receiveMessageWaitTimeSeconds'
];

var dateFields = [
    'createdTimestamp',
    'lastModifiedTimestamp',
];

SQS.prototype.getQueueAttributes = function(url){
    var queryUrl = parseUrl(url),
        params = {
            'AttributeName.1': 'All'
        };

    this.host = queryUrl.host;
    this.path = queryUrl.pathname;

    return this.makeRequest(function(response){
        var attrs = response.getQueueAttributesResponse.getQueueAttributesResult,
            res = {};

        attrs.forEach(function(attr){
            var name = common.camelize(attr.name),
                value;

            if(numberFields.indexOf(name) > -1){
                value = Number(attr.value);
            }
            else if(dateFields.indexOf(name) > -1){
                value = new Date(Number(attr.value) * 1000);
            }
            else {
                value = attr.value;
            }

            res[name] = value;
        });
        return res;

    }, 'GetQueueAttributes', params);
};

SQS.prototype.setQueueAttributes = function(url) {

};

SQS.prototype.sendMessage = function(url, message, delay) {
    var params = {
            'MessageBody': JSON.stringify(message),
            'DelaySeconds': delay || 0
        },
        queryUrl = parseUrl(url);

    this.host = queryUrl.host;
    this.path = queryUrl.pathname;

    return this.makeRequest(function(response){
        return response.sendMessageResponse.sendMessageResult.messageId;
    }, 'SendMessage', params);
};


SQS.prototype.receiveMessage = function(url, max, timeout) {
    max = max || 1;
    timeout = timeout || 30;

    var queryUrl = parseUrl(url),
        params = {
            'AttributeName.1': 'ALL',
            'MaxNumberOfMessages': max,
            'VisibilityTimeout': timeout
        };

    this.host = queryUrl.host;
    this.path = queryUrl.pathname;

    return this.makeRequest(function(response){
        if(!response.receiveMessageResponse.receiveMessageResult){
            return null;
        }
        return response.receiveMessageResponse.receiveMessageResult.message;
    }, 'ReceiveMessage', params);
};

SQS.prototype.changeMessageVisibility = function(url, receipt, timeout){
    var queryUrl = parseUrl(url),
        params = {
            'ReceiptHandle': receipt,
            'VisibilityTimeout': timeout
        };

    this.host = queryUrl.host;
    this.path = queryUrl.pathname;

    return this.makeRequest(function(response){
        return response;
    }, 'ChangeMessageVisibility', params);
};


SQS.prototype.deleteMessage = function(url, receipt) {
    var queryUrl = parseUrl(url),
        params = {};

    if(receipt){
        params.ReceiptHandle = receipt;
    }

    this.host = queryUrl.host;
    this.path = queryUrl.pathname;

    return this.makeRequest(function(response){
        return response;
    }, 'DeleteMessage', params);
};

// Can be up to 10 messages.
// Wrap this on a higher level to automatically chunk like mambo?
SQS.prototype.sendMessageBatch = function(url, batch) {
    var queryUrl = parseUrl(url),
        params = {};

    this.host = queryUrl.host;
    this.path = queryUrl.pathname;

    batch.forEach(function(message, index){
        params['SendMessageBatchRequestEntry.' + (index + 1) + '.MessageBody'] = message;
    });

    return this.makeRequest(function(response){
        return response;
    }, 'SendMessageBatch', params);
};

SQS.prototype.deleteMessageBatch = function(url, ids, receipts){
    var queryUrl = parseUrl(url),
        params = {};

    ids.forEach(function(id, index){
        params['DeleteMessageBatchRequestEntry.' + (index + 1) + '.Id'] = id;
        params['DeleteMessageBatchRequestEntry.' + (index + 1) + '.Receipthandle'] = receipts[index];
    });

    this.host = queryUrl.host;
    this.path = queryUrl.pathname;

    return this.makeRequest(function(response){
        return response;
    }, 'DeleteMessageBatch', params);
};

SQS.prototype.changeMessageVisibilityBatch = function(){

};

// If you're into the brevity thing.
SQS.prototype.queue = function(queueName, messageData){};
SQS.prototype.getMessages = function(queueName, max){};

// Shortcut for getting queue objects.
// @todo (lucas) Should also just create it if it doesnt exist.
SQS.prototype.Queue = function(name){
    var q = new Queue(),
        self = this;
    q.name = name;
    q.connection = this;

    function assemble(queue){
        console.log('Got queue', queue);
        q.id = queue.id;
        q.url = queue.url;
        q.getDetails()
        .then(function(stats){
            q._ready = true;
            q.emit('ready', stats);
        });
    }

    self.getQueue(name)
        .then(assemble, function(){
            // Does exist.  Create it then assemble.
            self.createQueue(name).then(assemble);
        });
    return q;
};

module.exports.SQS = SQS;

// Simplify above.
function Queue(id, name, url, connection){
    this.id = id;
    this.name = name;
    this.url = url;
    this.connection = connection;
    this._ready = (this.connection && this.url);
    this.putQueue = [];

    var self = this;
    this.on('ready', function(){
        self.processPutQueue();
    });
}
util.inherits(Queue, EventEmitter);

Queue.prototype.processPutQueue = function(){
    var self = this;
    if(self.putQueue.length === 0){
        return;
    }
    self.putQueue.forEach(function(i){
        var message = i[1],
            d = i[0];
        self.connection.sendMessage(self.url, message)
            .then(d.resolve, d.reject);
    });
    self.putQueue = [];
};

Queue.fromUrl = function(url, connection){
    var regex = /http\:\/\/queue\.amazonaws\.com\/(\d+)\/(\w+)/,
        matches = url.match(regex);
    return new Queue(matches[1], matches[2], url, connection);
};

Queue.prototype.remove = function(){
    return this.connection.deleteQueue(this.url, this.name);
};

Queue.prototype.put = function(message){
    if(!this._ready){
        var d = when.defer();
        this.putQueue.push([d, message]);
        return d.promise;
    }
    return this.connection.sendMessage(this.url, message);
};

Queue.prototype.getDetails = function(){
    return this.connection.getQueueAttributes(this.url);
};

Queue.prototype.get = function(max, timeout){
    max = max || 1;
    timeout = timeout || 0;
    var self = this;
    return this.connection.receiveMessage(this.url, max, timeout).then(function(msg){
        return new Message(msg, self);
    });
};

// Create a new `Message` instance?
Queue.prototype.createMessage = function(data){

};

// Create a new message batch?
Queue.prototype.batch = function(messages){

};

// Start polling for messages.
Queue.prototype.listen = function(interval){
    interval = interval || 1000;

    var self = this;

    if(this._ready){
        self.pollInterval = setInterval(function(){
            self.get(1).then(function(message){
                // console.log('Poll got', message);
                if(message){
                    self.emit('message', message);
                }
            });
        }, interval);
        // console.log('Queue ' + this.name + ' listening for new messages');
    }
    else{
        this.on('ready', function(){
            self.listen(interval);
        });
    }

};

// Stop polling for messages.
Queue.prototype.close = function(){
    clearInterval(this.pollInterval);
};

// { sendMessageResponse:
//    { sendMessageResult:
//       { messageId: '68e22b60-57fe-43be-aa35-ba29b768784f',
//         mD5OfMessageBody: '00b247f86176cdcae85e16fa6b6e839d' },
//      responseMetadata: { requestId: '2d81e69b-4ce0-58ab-9142-afb96274007f' } } }

// { body: '{"task":"buildSlide"}',
//   mD5OfBody: '00b247f86176cdcae85e16fa6b6e839d',
//   receiptHandle: '0NNAq8PwvXthGxDl8IfWTu3rKhTtgHamXO3eFg3b0rBNwbqok6cGg8eqnlbTejhgeIW5axQ0AFkdQbxdf/pShysWEWsSJxFwdfhGIAENmbW4oWHMJ5859zZFc67C3W3HZEuOBiL5WfqerwfjVm9djmvPCE+GsK9SmMJUaJUAUu9/dC2DyeyykGbjSf8/QsatYP9bNuWAE1HJE1qMq3fiyuYX+WB9VOhUjwkjP30taG1ZqbQd0l0y1QLQhqv40TwFueo7Rcgkk9J+4h9AILbAV2Ks3WSaEOAG1z9OdHsr1+4=',
//   messageId: 'c69f6d8e-6a33-426d-b2a5-ce7446cb2f9c' }
function Message(res, queue){
    this.queue = queue;
    if(res.body === Object(res.body)){
        this.body = res.body;
    }
    else {
        this.body = JSON.parse(res.body);
    }
    this.id = res.messageId;
    this.receipt = res.receiptHandle;
    this.md5 = res.mD5OfBody;
}

Message.prototype.ack = function(){
    this.queue.emit('ack', this);
    return this.queue.connection.deleteMessage(this.queue.url, this.receipt);
};

// Extend the visibility timeout of this message.
Message.prototype.extend = function(timeout){
    return this.queue.connection.changeMessageVisibility(
        this.queue.url, this.receipt, timeout);
};

// Update message visibility timeout to 0 so it gets picked up as soon
// as possbile by another worker.
Message.prototype.retry = function(){
    return this.extend(0);
};

function MessageBatch(){

}

MessageBatch.prototype.ack = function(){

};