var _     = require('underscore');
var amqp  = require('amqp');
var async = require('async');
var yaml  = require('js-yaml');
var fs    = require('fs');
var Q     = require('q');

var Pigeon = function() {
    _.bindAll(this, '_getExchange');
    // contains registered amqp exchange objects
    this.exchanges = {};
    // contains registered amqp queue objects
    this.queues    = {};
    // contains list of subscriptions
    this.subscriptions = [];
    this.connectionQ = Q.defer();
};

_.extend(Pigeon.prototype, {
    ////////////////////////////////////////////////////////////
    //// Public Methods ////////////////////////////////////////
    ////////////////////////////////////////////////////////////

    // Creates a rabbitmq connection
    connect : function(options) {
        var self = this;

        if (typeof options == 'string') {
            this.options = yaml.load(fs.readFileSync(options).toString());
        }
        else {
            this.options = options;
        }

        this.rabbit = amqp.createConnection(this.options.connection || {}, this.options.implementation || {});
        this.rabbit.on('ready', function() {
            self.connectionQ.resolve(this);
        });

        return this;
    },

    // Terminate the connection
    disconnect : function() {
        this.rabbit.end();

        return this;
    },

    // Publishes an event to an exchange with `type` as the routing key
    publish : function(type, message) {
        var self         = this,
            eventOptions = this._getEventOptionsForType(type);

        this.connectionQ.promise.then(function(){
            self._getExchangesForType(type, function(err, exchanges) {
                _.each(exchanges, function(exchange) {
                    exchange.publish(type, message, eventOptions);
                });
            });
        });

        return this;
    },

    // Subscribes to the specified queue
    subscribe : function(type, options, handler) {
        var self = this,
            key  = {};

        if (typeof options == 'function') {
            callback = handler;
            handler  = options;
            options  = {};
        }

        this.connectionQ.promise.then(function(){
            self._getQueue(type, function(err, queue) {
                // for messages that require acknowlegement, modify the handler
                // to receive the queue.shift method as a final argument
                if (options && options.ack) {
                    var original_handler = handler;
                    var lastArgIndex     = original_handler.length-1;
                    var shift            = _.bind(queue.shift, queue);
                    handler = function() {
                        var args = Array.prototype.slice.call(arguments);
                        // add the ack callback as the last argument
                        args.splice(lastArgIndex, 0, shift);
                        original_handler.apply(this, args);
                    };
                }
                queue.subscribe(options, handler)
                    .addCallback(function(ok) {
                        self.subscriptions.push({key:key, consumerTag:ok.consumerTag, queue:queue});
                    });
            });
        });

        return key;
    },

    unsubscribe : function(subscriptionKey) {
        for(var i = this.subscriptions.length; --i >=0;) {
            var subscription = this.subscriptions[i];
            if (subscription.key === subscriptionKey || subscription.consumerTag == subscriptionKey) {
                subscription.queue.unsubscribe(subscription.consumerTag);
                this.subscriptions.splice(i, 1);
                break;
            }
        }

        return this;
    },

    ////////////////////////////////////////////////////////////
    //// Private Methods ///////////////////////////////////////
    ////////////////////////////////////////////////////////////

    // Registers an exchange with rabbitmq
    _addExchange : function(exchangeConfig, callback) {
        var self = this;

        this.rabbit.exchange(exchangeConfig.name, exchangeConfig.options || {}, function(exchange) {
            self.exchanges[exchangeConfig.name] = exchange;
            self._addBindings(exchange, exchangeConfig.bindings, function(err, results) {
                if (callback) callback(null, exchange);
            });
        });
    },

    // Registers a queue with rabbitmq
    _addQueue : function(queueConfig, callback) {
        var self = this;
        this.rabbit.queue(queueConfig.anonymous ? '' : queueConfig.name, queueConfig.options || {}, function(queue) {
            self.queues[queueConfig.name] = queue;
            self._addBindings(queue, queueConfig.bindings, function(err, results) {
                if (callback) callback(null, queue);
            });
        });
    },

    // Binds an exchange or queue to all exchanges specified by the bindings array
    _addBindings : function(object, bindings, callback) {
        var self          = this,
            exchangeNames = _.keys(bindings || {});

        async.each(
            exchangeNames,
            self._getExchange,
            function() {
                _.each(exchangeNames, function(name) {
                    _.each(bindings[name] || [''], function(key) {
                        object.bind(name, key);
                    })
                });
                callback();
            }
        );
    },

    // Gets an exchange by name
    _getExchange : function(name, callback) {
        if (this.exchanges[name]) {
            callback(null, this.exchanges[name]);
        }
        else {
            var config = _.findWhere(this.options.publishers, {name:name});
            this._addExchange(config, callback);
        }
    },

    // Gets a queue by name
    _getQueue : function(name, callback) {
        if (this.queues[name]) {
            callback(null, this.queues[name]);
        }
        else {
            var config = _.findWhere(this.options.subscribers, {name:name});
            this._addQueue(config, callback);
        }
    },

    // Finds all exchanges that publish events of the type specified
    _getExchangesForType : function(type, callback) {
        var self    = this,
            configs = _.filter(this.options.publishers, function(exchangeConfig) {
                return exchangeConfig.publishes == '*' || _.contains(exchangeConfig.publishes, type)
            });

        async.mapSeries(
            configs,
            function(config, callback) {
                self._getExchange(config.name, callback);
            },
            callback
        );
    },

    // Gets the rabbitmq event options for a given event type
    _getEventOptionsForType : function(type) {
        var eventOptions = this.options.eventOptions;

        return eventOptions
            ? eventOptions[type] || eventOptions.default || {}
            : {};
    }
});

// provide a singleton getter
(function(){
    var instance = null;

    Pigeon.getInstance = function() {
        if (instance === null) {
            instance = new Pigeon()
        }
        return instance;
    }
})();

module.exports = Pigeon;