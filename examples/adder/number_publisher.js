#!/usr/bin/env node

var Pigeon = require('pigeon').getInstance().connect('config.yml');

process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', function (text) {
    text = text.replace('\n','');
    if (text.match(/^\d+$/)) {
        Pigeon.publish('number-entered', {value:parseInt(text)});
    } else {
        console.log('Please enter an integer');
    }
});