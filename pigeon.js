var _     = require('underscore');
var amqp  = require('amqp');
var async = require('async');
var yaml  = require('js-yaml');
var fs    = require('fs');

var Pigeon = function() {
    _.bindAll(this, '_getExchange');
    // contains registered amqp exchange objects
    this.exchanges = {};
    // contains registered amqp queue objects
    this.queues    = {};
};

_.extend(Pigeon.prototype, {
    ////////////////////////////////////////////////////////////
    //// Public Methods ////////////////////////////////////////
    ////////////////////////////////////////////////////////////

    // Creates a rabbitmq connection
    connect : function(options, callback) {
        var self = this;

        if (typeof options == 'string') {
            this.options = yaml.load(fs.readFileSync(options).toString());
        }
        else {
            this.options = options;
        }

        this._connectionReady = false;
        this._pending = [];

        this.rabbit = amqp.createConnection(this.options.connection || {}, this.options.implementation || {});
        this.rabbit.on('ready', function() {
            self._connectionReady = true;
            // calls to publish and subscribe that took place
            // before the connection was ready were added to the
            // pending list and should be processed now
            if (self._pending.length) {
                _.each(self._pending, function(args) {
                    // calls publish or subscribe with the original arguments
                    self[args.shift()].apply(self, args);
                });
                delete(self._pending);
            }

            if (callback) callback();
        });

        return this;
    },

    // Terminate the connection
    disconnect : function() {
        this.rabbit.end();

        return this;
    },

    // Publishes an event to an exchange with `type` as the routing key
    publish : function(type, message, callback) {
        if (!this._connectionReady) {
            this._pending.push(['publish', type, message, callback]);
            return this;
        }

        var self         = this,
            eventOptions = this._getEventOptionsForType(type);

        this._getExchangesForType(type, function(err, exchanges) {
            _.each(exchanges, function(exchange) {
                exchange.publish(type, message, eventOptions);
            });
            if (callback) callback();
        });

        return this;
    },

    // Subscribes to the specified queue
    subscribe : function(type, options, handler, callback) {
        if (!this._connectionReady) {
            this._pending.push(['subscribe', type, options, handler, callback]);
            return this;
        }

        var self = this;

        if (typeof options == 'function') {
            handler  = options;
            callback = handler;
            options  = {};
        }

        this._getQueue(type, function(err, queue) {
            // for messages that require acknowlegement, modify the handler
            // to receive the queue.shift method as a final argument
            if (options && options.ack) {
                var original_handler = handler;
                var shift            = _.bind(queue.shift, queue);
                handler = function() {
                    var args = Array.prototype.slice.call(arguments);
                    args.push(shift);
                    original_handler.apply(this, args);
                };
            }
            queue.subscribe(options, handler);
            if (callback) callback();
        });

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

module.exports = Pigeon