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

  m.on('broadcast', function(srcId, label, streams) {
    var videos = [];

    streams.forEach(function(stream) {
      media(stream).render(videos[videos.length] = crel('video'));
    })

    videos.forEach(function(vid) {
      document.body.appendChild(vid);
    });

    m.once('endbroadcast:' + srcId + ':' + label, function() {
      videos.forEach(function(vid) {
        document.body.removeChild(vid);
      });
    });
  });

  // capture local video and broadcast
  media()
    .once('capture', m.broadcast.bind(m))
    .render(localVideo);

  document.body.appendChild(localVideo);
});
