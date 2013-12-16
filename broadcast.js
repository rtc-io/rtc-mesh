/* jshint node: true */
'use strict';

var defaults = require('cog/defaults');

function Broadcast(src, media, opts) {
  if (! (this instanceof Broadcast)) {
    return new Broadcast(src, stream, opts);
  }

  // save the source member
  this.src = src;

  // initilaise the opts
  this.label = (opts || {}).label;
  this.targets = (opts || {}).targets || [];
}

module.exports = Broadcast;