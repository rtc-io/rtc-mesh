var quickconnect = require('rtc-quickconnect');
var mesh = require('../');

// initialise the connection
var qc = quickconnect('https://switchboard.rtc.io/', {
  room: 'meshdemo-simple'
});

// create the model
var model = mesh(qc);

// report data change events
model.on('change', function(key, value) {
  console.log('captured change key: "' + key + '" set to ', value);
});

model.set('lastjoin', Date.now());
