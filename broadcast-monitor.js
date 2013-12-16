/* jshint node: true */
'use strict';

/**
  ### broadcastMonitor

  This is a scuttlebutt Model change handler that examines the key that has
  changed and determines whether it is part of a WebRTC media negotiation.

**/
module.exports = function(mesh) {
  // create the receive streams object
  var recvPCS = {};

  return function(key, value) {
    var parts = key.split(':');

    switch (parts[0]) {
      case 'offer': {
      }

      case 'candidates': {
      }
    }
  };
};