var _     = require('underscore'),
    amqp  = require('amqp'),
    sinon = require('sinon'),
    Mock  = {},
    cTag  = 0;

(function() {
    var _original_impl = amqp.createConnection;
    Mock.restore = function() {
        amqp.createConnection = this._original_impl;
    };
    Mock.mock = function() {
        amqp.createConnection = sinon.spy(function() {
            return {
                on : sinon.spy(function(evt, cb) {
                    cb();
                }),
                queue : sinon.spy(function(name, options, cb) {
                    var queue = {
                        bind : sinon.spy(),
                        subscribe : sinon.spy(function(options, handler) {
                            handler(1,2,3,4);
                            return {
                                addCallback : sinon.spy(function(cb){
                                    cb({consumerTag:cTag++});
                                })
                            };
                        }),
                        unsubscribe : sinon.spy(function(consumerTag) {
                            return {
                                addCallback : sinon.spy(function(cb){
                                    cb();
                                })
                            };
                        }),
                        shift : sinon.spy()
                    };
                    
                    cb(queue);

                    return queue;
                }),
                exchange : sinon.spy(function(name, options, cb) {
                    var exchange = {
                        bind : sinon.spy(),
                        publish : sinon.spy()
                    };

                    cb(exchange);
                    
                    return exchange;
                }),
                end : sinon.spy()
            }
        });
    };
})();

module.exports = Mock;