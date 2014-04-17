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

  ## Reference

**/

/**
  ### mesh

  ```
  mesh(qc, opts?) => Model
  ```

  As displayed in the examples, the `mesh` function expects to be passed a
  [quickconnect](https://github.com/rtc-io/rtc-quickconnect) created signaller. Using
  this object, it will create a data channel that will be responsible for sharing
  [scuttlebutt](https://github.com/dominictarr/scuttlebutt) model information with peers.

  In addition to the functions exposed by a scuttlebutt Model, the following helpers
  have also been added:

**/
module.exports = function(qc, opts) {
  // create the model
  var model = (opts || {}).model || new Model();
  var name = (opts || {}).channelName || 'mesh';
  var channels = {};

  function joinMesh(id, dc) {
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

    reader.on('error', function(err) {
      console.warn('captured reader stream error: ', err.message);
    });

    writer.on('error', function(err) {
      console.warn('captured writer stream error: ', err.message);
    });

    // connect the stream to the data
    reader.pipe(stream).pipe(writer);

    // bubble sync events
    writer.on('sync', model.emit.bind(model, 'sync'));
  }

  function joinMeshDeprecated(dc, id) {
    joinMesh(id, dc);
  }

  function leaveMesh(id) {
    // remove the channel reference
    channels[id] = null;
  }

  /**
    #### retrieve

    ```
    retrieve(key, callback)
    ```

    Get the value of the specified key and pass the result back through the
    provided `callback` (node error first style).  If the value is already
    available in the local Model, then the callback will be triggered immediately.
    If not, the callback will be triggered once the value has been set in the
    local Model.
  **/
  function retrieve(key, callback) {
    var value = model.get(key);

    // if we have the value, then trigger the callback immediately
    if (typeof value != 'undefined') {
      return callback(null, value);
    }

    // otherwise, wait for the value
    model.once('change:' + key, callback.bind(model, null));
  }

  // patch in the retrieveValue function
  model.retrieve = retrieve;

  // create the data channel
  qc.createDataChannel(name, (opts || {}).channelOpts)
    .on(name + ':open', joinMeshDeprecated)
    .on('channel:opened:' + name, joinMesh)
    .on(name + ':close', leaveMesh)
    .on('channel:closed:' + name, leaveMesh);

  return model;
};
