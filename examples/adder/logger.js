#!/usr/bin/env node

var Pigeon = require('pigeon-post').getInstance().connect('config.yml');

Pigeon.subscribe('logger', function(json) {
    console.log('LOGGER (' + process.pid + '): Received a number-entered event', json)
});

/** amqp implementation **

var connection = amqp.createConnection();
connection.on('ready', function() {
    connection.exchange('numbers', {type:'fanout'}, function(numExchange){
        connection.queue('', function(queue) {
            queue.bind(numExchange, 'number-entered');
            queue.subscribe(function(json) {
                console.log('LOGGER (' + process.pid + '): Received a number-entered event', json)
            });
        });
    });
});

**/