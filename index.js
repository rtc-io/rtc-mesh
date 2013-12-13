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

  ## Reference

**/

/**
  ### join(roomName, opts?, callback)

**/
var join = exports.join = function(roomName, opts, callback) {
  var peer;

  // check for no opts
  if (typeof opts == 'function') {
    callback = opts;
    opts = {};
  }

  // ensure we have a callback
  callback = callback || function() {};

  // create a new peer instance
  peer = new RTCMeshMember(extend({}, opts));

  // handle errors during connection
  peer.on('error', callback);

  // once the peer is online, trigger the callback
  peer.once('online', function() {
    peer.removeListener('error', callback);
    callback(null, peer);
  });

  // announce
  peer.announce({ room: roomName });
};

/**
  ### use(signalhost)

**/
exports.use = function(signalhost) {
  // update the default signal host
  defaults.signalhost = signalhost;

  // return exports for chaining
  return exports;
};