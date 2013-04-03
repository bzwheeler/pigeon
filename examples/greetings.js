var Pigeon = require('pigeon').getInstance();

Pigeon
    .connect({
        publishers : [
            {
                name      : 'greeter',
                options   : 'fanout',
                publishes : ['greeting']
            }
        ],
        subscribers : [
            {
                name     : 'receptionist',
                bindings : {
                    greeter : ['greeting']
                }
            }
        ]
    })
    .subscribe('receptionist', {}, function(msg) { console.log(msg) })