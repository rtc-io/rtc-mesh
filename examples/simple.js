var mesh = require('../');

// use the demo rtc.io signalling server
mesh.use('http://rtc.io/switchboard/');

// join the mesh in the friends test room
mesh.join('meshdemo-simple', function(err, m) {
  if (err) {
    return console.error('could not connect: ', err);
  }

  m.on('data:update', function(key, value) {
    console.log('key: ' + key + ', set to: ', value);
  });

  // update the last join time for the shared data
  m.data.set('lastjoin', Date.now());
});

