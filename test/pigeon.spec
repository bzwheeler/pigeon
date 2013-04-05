var should    = require('should'),
    sinon     = require('sinon'),
    amqp      = require('amqp'),
    amqpmock  = require('./mocks/amqp'),
    libpath   = process.env['PIGEON_COV'] ? '../lib-cov' : '../lib';
    Pigeon = require(libpath + '/pigeon'),
    config    = {
                    publishers : [
                        {
                            name      : 'fanout',
                            options   : {type: 'fanout'},
                            publishes : '*'
                        },
                        {
                            name      : 'direct',
                            options   : {type:'direct'},
                            publishes : ['bar'],
                            bindings  : {fanout:['foo']}
                        }
                    ],
                    subscribers : [
                        {
                            name      : 'foo',
                            anonymous : true,
                            bindings  : {direct:['foo']}
                        }
                    ],
                    eventOptions : {
                        foo : {
                            deliveryMode : 1
                        },
                        default : {
                            deliveryMode : 2
                        }
                    }
                };

describe('Pigeon', function() {
    beforeEach(function() {
        amqpmock.mock();
    });
    describe('connect', function() {
        it('should connect to rabbit and create appropriate exchanges and queues', function(done) {
            var instance = new Pigeon();

            var handler  = sinon.spy();
            var callback = sinon.spy();

            instance.connect(config, callback);

            process.nextTick(function() {
                callback.calledOnce.should.be.true;
                amqp.createConnection.calledOnce.should.be.true;

                var connection = amqp.createConnection.returnValues[0];
                connection.on.calledOnce.should.be.true;
                connection.on.calledWith('ready').should.be.true;
                done();
            });
        })
    });

    describe('publish', function() {
        it('should publish the event to the appropriate exchange', function(done) {
            var instance = new Pigeon();
            instance.connect(config, function() {
                var callback   = sinon.spy();
                var connection = amqp.createConnection.returnValues[0];

                instance.publish('foo', 'fooValue', callback);

                process.nextTick(function() {
                    callback.calledOnce.should.be.true;

                    connection.exchange.calledOnce.should.be.true;
                    connection.exchange.calledWith('fanout', {type:'fanout'}).should.be.true;

                    var fanout = connection.exchange.returnValues[0];
                    fanout.bind.called.should.be.false;
                    fanout.publish.calledOnce.should.be.true;
                    fanout.publish.calledWithExactly('foo', 'fooValue', {deliveryMode:1}).should.be.true;

                    instance.publish('bar', 'barValue', callback);

                    process.nextTick(function() {
                        callback.calledTwice.should.be.true;

                        connection.exchange.calledTwice.should.be.true;
                        connection.exchange.secondCall.calledWith('direct', {type:'direct'}).should.be.true;
                        
                        fanout.publish.calledTwice.should.be.true;
                        fanout.publish.secondCall.calledWithExactly('bar', 'barValue', {deliveryMode:2}).should.be.true;

                        var direct = connection.exchange.returnValues[1];
                        direct.bind.calledOnce.should.be.true;
                        direct.bind.calledWithExactly('fanout', 'foo').should.be.true;
                        direct.publish.calledOnce.should.be.true;
                        direct.publish.calledWithExactly('bar', 'barValue', {deliveryMode:2}).should.be.true;

                        done();
                    });
                });
            });
        });

        it('should allow immediate calls', function(done) {
            var instance = new Pigeon();
            instance.connect(config);
            (function() {
                instance.publish('foo', 'fooValue');
            }).should.not.throw();
            done();
        });
    });

    describe('subscribe', function() {
        it('should subscribe to the appropriate queue', function(done) {
            var handler = function(){};
            var instance = new Pigeon();
            instance.connect(config, function() {
                var connection = amqp.createConnection.returnValues[0];

                instance.subscribe('foo', handler, function(queue) {

                    connection.queue.calledOnce.should.be.true;
                    connection.queue.calledWith('', {}).should.be.true;
                    queue.bind.calledOnce.should.be.true;
                    queue.bind.calledWithExactly('direct', 'foo').should.be.true;
                    queue.subscribe.calledOnce.should.be.true;
                    queue.subscribe.calledWithExactly({}, handler).should.be.true;

                    var ack = sinon.spy(function(json, headers, deliveryInfo, message, next) {
                        queue.shift.calledOnce.should.be.false;
                        next();
                        queue.shift.calledOnce.should.be.true;
                    });

                    instance.subscribe('foo', {ack:true}, ack);
                    ack.calledOnce.should.be.true;

                    queue.subscribe.calledTwice.should.be.true;


                    done();
                });
            });
        });

        it('should allow immediate calls', function(done) {
            var instance = new Pigeon();
            instance.connect(config);
            (function() {
                instance.subscribe('foo', function(){});
            }).should.not.throw();
            process.nextTick(function(){

            });
            done();
        });
    });

    describe('disconnect', function() {
        it('should disconnect', function(done) {
            var instance = new Pigeon();
            instance.connect(config, function() {
                var connection = amqp.createConnection.returnValues[0];
                instance.disconnect();
                connection.end.calledOnce.should.be.true;
                done();
            });
        });
    });

    describe('getInstance', function() {
        it('should get a singleton instance', function(done) {
            var instance = Pigeon.getInstance();
            instance.should.be.an.instanceOf(Pigeon);
            var instance2 = Pigeon.getInstance();
            instance2.should.equal(instance);
            done();
        });
    })
});

