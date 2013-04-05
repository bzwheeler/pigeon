#!/usr/bin/env node

var Pigeon = require('pigeon-post').getInstance().connect('config.yml'),
    sum    = 0;

Pigeon.subscribe('adder-worker', {ack:true}, function(json, headers, deliveryInfo, message, next) {
    console.log('ADDER-WORKER (' + process.pid + '): Processing', json);
    sum += json.value;
    console.log('ADDER-WORKER: Running total is: ', sum);
    next();
});