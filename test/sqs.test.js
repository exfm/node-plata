"use strict";

var aws = require('../'),
    assert = require('assert');

aws.connect({'file': __dirname + '/auth.json'});

describe("SQS", function(){
    it("should create a queue", function(done){
        var name = 'platatest';
        aws.sqs.createQueue(name).then(function(queue){
            aws.sqs.listQueues().then(function(queues){
                assert.equal(queues.filter(function(q){
                    return q.name === name;
                })[0].name, name);
                aws.sqs.getQueue(name).then(function(q){
                    q.remove().then(function(res){
                        done();
                    });
                });
            });
        }, done);
    });
    it("should convert a queue URL to a Queue object", function(){
        var queue = aws.sqs.queueFromUrl('http://queue.amazonaws.com/160241911954/platatest2');
        assert.equal(queue.id, '160241911954');
        assert.equal(queue.name, 'platatest2');
    });
    it('should get some attributes', function(done){
        var name = 'platatest_getattr';
        aws.sqs.createQueue(name).then(function(queue){
            queue.getDetails().then(function(res){
                assert.equal(Object.keys(res).length, 11);
                queue.remove().then(function(res){
                    done();
                });
            }, done);
        }, done);
    });
    it('should send a message and get it', function(done){
        var name = 'platatest_send';
        aws.sqs.createQueue(name).then(function(queue){
            queue.put({'task': 'buildSlide'}).then(function(res){
                queue.get(1).then(function(res){
                    queue.remove().then(function(res){
                         done();
                    });
                });
            });

        }, done);
    });

    it('should ack a message', function(done){
        var name = 'platatest_send2',
            details;

        aws.sqs.createQueue(name).then(function(queue){
            queue.getDetails().then(function(d){
                details = d;
                return d;
            }).then(function(){
                return queue.put({'task': 'buildSlide'});
            }).then(function(){
                return queue.get(1);
            }).then(function(message){
                return message.ack();
            }).then(function(){
                return queue.getDetails();
            }).then(function(d){
                assert.equal(d.approximateNumberOfMessages,
                    details.approximateNumberOfMessages);
                return queue.remove();
            }).then(function(){
                done();
            });

        }, done);
    });
    it('should retry a message', function(done){
        var name = 'platatest_retry',
            queue,
            details;

        aws.sqs.createQueue(name)
            .then(function(q){
                queue = q;
                return queue.getDetails();
            }).then(function(d){
                details = d;
                return d;
            }).then(function(){
                return queue.put({'task': 'buildSlide'});
            }).then(function(){
                return queue.get(1);
            }).then(function(message){
                return message.retry();
            }).then(function(){
                return queue.getDetails();
            }).then(function(d){
                assert.equal(d.approximateNumberOfMessages,
                    details.approximateNumberOfMessages + 1);
                return queue.remove();
            }).then(function(){
                done();
            });
    });
    it('should have a nice event interface for workers', function(done){
            var name = 'platatest_send3',
                queue,
                details,
                sentMessageId;

            queue = aws.sqs.Queue(name);
            queue.on('ready', function(stats){
                // console.log('Queue is ready.  Here are its stats.', stats);
            });

            queue.on('message', function(message){
                // Stop listening for new messages.
                // Got for cases like metadata where we don't want more than
                // one task per core going at a time.
                queue.close();

                assert.equal(message.body.task, 'build slide');
                message.ack();

                // Listen for more messages.
                queue.listen(100);
            });

            queue.on('ack', function(message){

                assert.equal(message.id, sentMessageId);
                done();
            });
            queue.listen(100);

            queue.put({'task': 'build slide'})
                .then(function(messageId){
                    // console.log('Put new message', messageId);
                    sentMessageId = messageId;
                });
        });
    it("should send a batch", function(done){
        var name = 'platatest_batch',
            queue = aws.sqs.Queue(name),
            messages = [
                {'task': 'build slide'},
                {'task': 'build swingset'},
                {'task': 'build monkeybars'}
            ],
            batch = queue.batch(messages);
        queue.on('ready', function(){
            console.log('Got queue ready');
        });

        batch.put().then(function(acks){
            assert.equal(acks.length, 3);
            done();
        });
    });
});