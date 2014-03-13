/* jshint node: true */
'use strict';

var debug = require('cog/logger')('rtc-mesh');
var dcstream = require('rtc-dcstream');
var Model = require('scuttlebutt/model');

/**
  # rtc-mesh

  __NOTE:__ From version `0.5` onwards `rtc-mesh` is now an
  [rtc-quickconnect](https://github.com/rtc-io/rtc-quickconnect) plugin
  (which is heaps better and cleaner).

  The `rtc-mesh` module provides a way of sharing data between clients using
  [scuttlebutt](https://github.com/dominictarr/scuttlebutt).

  ## Simple Example

  <<< examples/simple.js

  ## Using Scuttlebutt Subclasses

  Here's an example using
  [CRDT](https://github.com/dominictarr/crdt):

  <<< examples/crdt.js

  ## Synchronizing Multiple Datasets

  It's also possible to create invoke multiple meshes on a single data
  channel using custom channel names (by default the a channel is created with
  the name of `mesh`).

  <<< examples/multichannel.js

**/

module.exports = function(qc, opts) {
  // create the model
  var model = (opts || {}).model || new Model();
  var name = (opts || {}).channelName || 'mesh';
  var channels = {};

  function joinMesh(dc, id) {
    // create a new stream
    var stream = dcstream(dc);
    var reader = model.createReadStream();
    var writer = model.createWriteStream();

    debug('connecting mesh with peer: ' + id);

    // register the channel
    channels[id] = dc;

    stream.on('error', function(err) {
      console.warn('captured stream error: ', err.message)
    });

    // connect the stream to the data
    reader.pipe(stream).pipe(writer);

    // bubble sync events
    writer.on('sync', model.emit.bind(model, 'sync'));
  }

  function leaveMesh(id) {
    // remove the channel reference
    channels[id] = null;
  }

  // create the data channel
  qc.createDataChannel(name, (opts || {}).channelOpts)
    .on(name + ':open', joinMesh)
    .on(name + ':close', leaveMesh);

  return model;
};