/* jshint node: true */
'use strict';

var debug = require('cog/logger')('rtc-mesh-broadcast');
var defaults = require('cog/defaults');

function Broadcast(mesh, label, media, opts) {
  if (! (this instanceof Broadcast)) {
    return new Broadcast(src, stream, opts);
  }

  // save the source member
  this.mesh = mesh;

  // initilaise the opts
  this.label = (opts || {}).label || 'primary';
  this.targets = (opts || {}).targets;

  // if we have media and a stream, then send the stream
  if (media && media.stream) {
    this.send(media.stream);
  }
  else if (media && typeof media.once == 'function') {
    media.once('capture', this.send.bind(this));
  }

  // TODO: monitor new peers joining the mesh
}

module.exports = Broadcast;
var proto = Broadcast.prototype;

/**
  #### send(stream)

  Send the specified stream to either all members of the mesh or only
  those that were specified in the broadcast constructor.
**/
proto.send = function(stream) {
  debug('sending stream: ', stream);

  // for each of the specified targets (or all active peers)

    // create a new send only peer connection

    // add the stream to the pc

    // create an offer and then publish to the shared data state
};