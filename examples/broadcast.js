var mesh = require('../');
var crel = require('crel');
var media = require('rtc-media');

// use the demo rtc.io signalling server
mesh.use('http://rtc.io/switchboard/');
require('cog/logger').enable('rtc-mesh', 'rtc-mesh-broadcast', 'rtc-mesh-receiver');

var localVideo = crel('video');

// join the mesh in the friends test room
mesh.join('mesh-broadcast-test', function(err, m) {
  if (err) {
    return console.error('could not connect: ', err);
  }

  // capture local video and broadcast
  media()
    .once('capture', function(stream) {
      m.broadcast(stream);
    })
    .render(localVideo);

  m.on('broadcast', function(srcId, streams, metadata) {
    streams.forEach(function(stream) {
      var vid;

      media(stream).render(vid = crel('video'));
      document.body.appendChild(vid);
    })
  });

  document.body.appendChild(localVideo);
});
