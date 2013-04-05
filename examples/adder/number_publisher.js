#!/usr/bin/env node

var Pigeon = require('pigeon-post').getInstance().connect('config.yml');

setInterval(function() {
    Pigeon.publish('number-entered', {value:Math.round(Math.random() * 1000)});
}, 1000);

/** amqp implementation **

var connection = amqp.createConnection();
connection.on('ready', function() {
    connection.exchange('numbers', {type:'fanout'}, function(numExchange){
        numExchange.publish('number-entered', {value:Math.round(Math.random() * 1000)});
    });
});

**/