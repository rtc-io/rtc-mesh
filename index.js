/* jshint node: true */
/* global location: false */
'use strict';

var defaults = require('./defaults');
var extend = require('cog/extend');
var RTCMeshMember = require('./member');

/**
  # rtc-mesh

  The `rtc-mesh` module provides functionality that will enable P2P data
  mesh to be created and kept in sync (using
  [scuttlebutt](https://github.com/dominictarr/scuttlebutt)).

  ## How it works

  The `rtc-mesh` module works by setting up a data-only WebRTC peer connection
  as peers are discovered in a particular room
  (using [rtc-signaller](https://github.com/rtc-io/rtc-signaller)).  A node
  compatible stream is then wrapped around the stream and we use
  [scuttlebutt](https://github.com/dominictarr/scuttlebutt) to keep data in
  sync with other peers via the data channel.

  ## Example Usage

  Below is a simple example showing how you can join a mesh, and update the
  shared data of the mesh:

  <<< examples/simple.js

  ## Firefox to Chrome Interop

  Tested Chrome 32 <==> Firefox 26 and it works nicely :)

  ## Reference

**/

/**
  ### join(roomName, opts?, callback)

  This is a helper factory function for creating a new `RTCMeshMember`
  instance that will join the specified room for the currently configured
  signalling server.

  ```js
  require('rtc-mesh').join('testroom', function(err, m) {
    if (err) {
      return console.error('error connecting: ', err);
    }

    console.log('connected to the mesh, id = ' + m.id);
  });
  ```

**/
var join = exports.join = function(roomName, opts, callback) {
  var member;

  // check for no opts
  if (typeof opts == 'function') {
    callback = opts;
    opts = {};
  }

  // ensure we have a callback
  callback = callback || function() {};

  // create a new member instance
  member = new RTCMeshMember(extend({}, opts));

  // handle errors during connection
  member.on('error', callback);

  // once the member is online, trigger the callback
  member.once('online', function() {
    member.removeListener('error', callback);
    callback(null, member);
  });

  // announce
  member.announce({ room: roomName });
};

/**
  ### use(signalhost)

  If you wish to configure a default signalling server to use, then this can
  be done using the `use` function.  For example if you wanted to use the
  test rtc.io switchboard for all your connections rather than defaulting to
  attmepting to use the same origin that your page was served from, use the
  following code:

  ```js
  mesh.use('http://rtc.io/switchboard/');
  ```

**/
exports.use = function(signalhost) {
  // update the default signal host
  defaults.signalhost = signalhost;

  // return exports for chaining
  return exports;
};