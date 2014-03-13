var quickconnect = require('rtc-quickconnect');
var mesh = require('../');

// initialise the connection
var qc = quickconnect('http://rtc.io/switchboard', {
  room: 'meshdemo-multichannel'
});

// create the models
var modelA = mesh(qc, { channelName: 'm1' });
var modelB = mesh(qc, { channelName: 'm2' });

// report data change events
modelA.on('change', function(key, value) {
  console.log('captured change for item in a: ', arguments);
});

modelB.on('change', function(key, value) {
  console.log('captured change for item in b: ', arguments);
})

// update some keys
modelA.set('lastjoin', Date.now());
modelB.set('lastRandom', (Math.random() * 10000) | 0);