#!/usr/bin/env node

var Pigeon = require('pigeon-post').getInstance().connect('config.yml');

Pigeon.subscribe('logger', function(json) {
    console.log('LOGGER (' + process.pid + '): Received a number-entered event', json)
});