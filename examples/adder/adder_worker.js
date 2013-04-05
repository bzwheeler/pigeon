#!/usr/bin/env node

var Pigeon = require('pigeon-post').getInstance().connect('config.yml'),
    sum    = 0;

Pigeon.subscribe('adder-worker', {ack:true}, function(json, headers, deliveryInfo, message, next) {
    console.log('ADDER-WORKER (' + process.pid + '): Processing', json);
    sum += json.value;
    console.log('ADDER-WORKER: Running total is: ', sum);
    next();
});

/** amqp implementation **

var connection = amqp.createConnection();
connection.on('ready', function() {
    connection.exchange('numbers', {type:'fanout'}, function(numExchange){
        connection.exchange('adder', {type: 'direct', durable: true, autoDelete: false}, function(adderExchange) {
            adderExchange.bind(numExchange, 'number-entered');
            connection.queue('adder-worker', {durable: true, autoDelete: false}, function(queue) {
                queue.bind(adderExchange, 'number-entered');
                queue.subscribe({ack:true}, function(json) {
                    console.log('ADDER-WORKER (' + process.pid + '): Processing', json);
                    sum += json.value;
                    console.log('ADDER-WORKER: Running total is: ', sum);
                    queue.shift();
                });
            });
        });
    });
});

**/