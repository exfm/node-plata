"use strict";

var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    common = require('../common'),
    Connection = require('../aws').Connection,
    when = require('when'),
    parseUrl = require('url').parse,
    uuid = require('node-uuid'),
    createLog = require('../logging'),
    log = createLog('plata.sqs');

function toBase64(data){
    var buf = new Buffer(JSON.stringify(data), 'utf-8');
    return buf.toString('base64');

}

function fromBase64(str){
    var buf = new Buffer(str, 'base64');
    try{
        return JSON.parse(buf.toString('utf-8'));
    }
    catch(e){
        log.error('Couldnt parse message!!!!');
        log.error(buf.toString('utf-8'));
        log.error(e.message);
        log.error(e.stack);
        throw e;
    }
}

function SQS(accessKeyId, secretAccessKey){
    SQS.super_.call(this, accessKeyId, secretAccessKey,
        'queue.amazonaws.com', '2012-11-05');

    this.log = log;
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
        return self.queueFromUrl(response.createQueueResponse.createQueueResult.queueUrl[0]);
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
        var res = response.listQueuesResponse.listQueuesResult.queueUrl;

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
            return response.getQueueUrlResponse.getQueueUrlResult.queueUrl[0];
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
        var attrs = response.getQueueAttributesResponse.getQueueAttributesResult.attribute,
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

// SQS.prototype.setQueueAttributes = function(url) {};

SQS.prototype.sendMessage = function(url, message, delay) {
    var params = {
            'MessageBody': toBase64(message),
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
        var id = uuid.v4(),
            body = toBase64(message);
        console.log('Id', id);
        console.log('Body', body);
        params['SendMessageBatchRequestEntry.' + (index + 1) + '.Id'] = id;
        params['SendMessageBatchRequestEntry.' + (index + 1) + '.MessageBody'] = body;
    });

    return this.makeRequest(function(response){
        return response.sendMessageBatchResponse.sendMessageBatchResult.sendMessageBatchResultEntry;
    }, 'SendMessageBatch', params, 'POST');
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
SQS.prototype.Queue = function(name){
    var q = new Queue(),
        self = this;
    q.name = name;
    q.connection = this;

    function assemble(queue){
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
    this._ready = (this.connection && this.url) ? true : false;
    this.putQueue = [];
    this.log = createLog('plata.sqs.queue');

    var self = this;
    this.on('ready', function(){
        self.processPutQueue();
    });
}
util.inherits(Queue, EventEmitter);

Queue.prototype.processPutQueue = function(){
    var self = this;
    if(self.putQueue.length === 0){
        self.log.silly('No queued puts.');
        return;
    }
    self.log.silly('Sending '+self.putQueue.length+'  queued puts...');
    self.putQueue.forEach(function(i){
        var message = i[1],
            d = i[0];
        if(Array.isArray(message)){
            self.connection.sendMessageBatch(self.url, message)
                .then(d.resolve, d.reject);
        }
        else {
            self.connection.sendMessage(self.url, message)
                .then(d.resolve, d.reject);
        }
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

Queue.prototype.putBatch = function(messages){
    if(!this._ready){
        var d = when.defer();
        this.putQueue.push([d, messages]);
        return d.promise;
    }
    return this.connection.sendMessageBatch(this.url, messages);
};

Queue.prototype.getDetails = function(){
    return this.connection.getQueueAttributes(this.url);
};

Queue.prototype.get = function(max, timeout){
    max = max || 1;
    timeout = timeout || 0;
    var self = this;
    return this.connection.receiveMessage(this.url, max, timeout).then(function(msg){
        if(msg){
            return new Message(msg, self);
        }
        return null;
    });
};

// Create a new message batch?
Queue.prototype.batch = function(messages){
    return new MessageBatch(messages, this);
};

// Start polling for messages.
Queue.prototype.listen = function(interval, cb){
    interval = interval || 1000;
    cb = cb || function(){};

    var self = this;
    if(this._ready){
        cb();
        self.log.silly('Getting initial messages...');
        self.get(1).then(function(message){
            if(message){
                self.log.silly('Emitting message!');
                self.emit('message', message);
            }
            self.log.silly('Setting poll interval of ' + interval);
            clearInterval(self.pollInterval);
            self.pollInterval = setInterval(function(){
                self.log.silly('Polling for messages...');
                self.get(1).then(function(message){
                    if(message){
                        self.log.silly('Emitting message!');
                        self.emit('message', message);
                    }
                });
            }, interval);
        }, function(e){
            self.log.error('WHOA.  get(1) rejected.' + e.message);
            self.log.error(e.stack);
        });
    }
    else{
        self.log.silly('Not ready yet.  Adding event listener for listen...');
        this.on('ready', function(){
            self.listen(interval, cb);
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
        this.body = fromBase64(res.body);
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

function MessageBatch(messages, queue){
    this.messages = messages;
    this.queue = queue;
    this.chunkSize = 10;
}

MessageBatch.prototype.put = function(){
    var d = when.defer(),
        self = this;

        when.all(this.messages.map(function(message){
            return self.queue.put(message);
        }),
            function(results){
                var all = [];
                results.forEach(function(result){
                    all.push(result);
                });
                d.resolve(all);
        }, d.reject);
    return d.promise;

};