pigeon
======

Configuration based RabbitMQ interface based on node-amqp

## Installation

    npm install pigeon

## Synopsis

An example of connecting to a server, publishing an event and receiving it

Configuration file
```yaml
publishers:
  -
    name: greeter
    options:
      type: fanout
    publishes:
      - greeting
subscribers
  -
    name: receptionist
    bindings:
      greeter:
        - greeting
```

Publisher
```javascript
var Pigeon = require('pigeon').getInstance();

Pigeon
    .connect('config.yml')
    .publish('greeting', {value:'Hello World'})
```

Subscriber
```javascript
var Pigeon = require('pigeon').getInstance();

Pigeon
    .connect('config.yml')
    .subscribe('receptionist', function(msg) {
        console.log(msg);
    });
```
