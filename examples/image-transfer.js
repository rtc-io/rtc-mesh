var mesh = require('../');
var crel = require('crel');
var detect = require('rtc-core/detect');
var dnd = require('drag-and-drop-files');
var filestream = require('filestream');
var img = crel('img');

// use the demo rtc.io signalling server
mesh.use('http://rtc.io/switchboard/');
// require('cog/logger').enable('rtc-dcstream');

// join the mesh in the friends test room
mesh.join('meshdemo-imagetransfer', function(err, m) {
  if (err) {
    return console.error('could not connect: ', err);
  }

  m.on('datastream', function(srcId, stream, type) {
    var writer = filestream.write();

    console.log('receiving file from: ' + srcId);
    stream.pipe(writer);

    stream.on('end', function() {
      console.log('captured read end');
    });

    writer.once('file', function(file) {
      console.log('detected file end');
      img.src = detect('URL').createObjectURL(file);
    });
  });

  function upload(files) {
    return function(targetId) {
      var queue = [].concat(files);

      function sendNext() {
        var next = queue.shift();

        m.to(targetId, { type: 'file' }, function(err, stream) {
          filestream.read(next).pipe(stream);
        });

        img.src = detect('URL').createObjectURL(next);
      }

      sendNext();
    };
  }

  dnd(document.body, function(files) {
    m.signaller.peers.keys().forEach(upload(files));
  });

  document.body.appendChild(crel('style', 'body, html { margin: 0; width: 100%; height: 100% }'));
  document.body.appendChild(img);
});
