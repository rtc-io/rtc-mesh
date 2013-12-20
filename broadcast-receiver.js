/* jshint node: true */
'use strict';

var debug = require('cog/logger')('rtc-mesh-receiver');
var defaults = require('cog/defaults');
var extend = require('cog/extend');
var detect = require('rtc-core/detect');
var through = require('through');
var Duplex = require('stream').Duplex;
var util = require('util');

module.exports = function(pc, ds, opts, callback) {

  var candidates = [];
  var handlers = {};
  var RTCSessionDescription = (opts || {}).RTCSessionDescription ||
    detect('RTCSessionDescription');
  var RTCIceCandidate = (opts || {}).RTCIceCandidate ||
    detect('RTCIceCandidate');


  function abort(err) {
    debug('error receiving broadcast: ', err);
    write('error', err);
    ds.end();
  }

  function answerReady(desc) {
    debug('answer created, setting local description');
    pc.setLocalDescription(
      desc,
      function() {
        debug('local description set, sending answer');
        write('answer', desc);
      },
      abort
    );
  }

  function checkConnectionState() {
    debug('connection state changed to: ' + pc.iceConnectionState);
    if (pc.iceConnectionState === 'connected') {
      // remove the handler
      pc.oniceconnectionstatechange = null;

      // end the datastream
      ds.end();

      return callback(null, pc.getRemoteStreams());
    }
  }

  function handleIceCandidate(evt) {
    if (evt.candidate) {
      candidates.push(evt.candidate);
    }
    else {
      write('candidates', { candidates: candidates });
    }
  }

  function write(type, payload) {
    // add the type to the payload
    payload = extend({}, payload, {
      type: type
    });

    debug('writing payload to the datastream: ', payload);
    return ds.write(JSON.stringify(payload));
  }

  handlers.candidates = function(data) {
    if (! pc.remoteDescription) {
      pc.onsignalingstatechange = function() {
        if (pc.signalingState === 'stable') {
          handlers.candidates(data);
        }
      };

      return;
    }

    debug('setting remote candidates: ', data.candidates);
    data.candidates.forEach(function(candidate) {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    });
  }

  handlers.offer = function(data) {
    debug('attempting to set remote description');
    pc.setRemoteDescription(
      new RTCSessionDescription(data),
      function() {
        debug('remote description set ok, creating answer');
        pc.createAnswer(answerReady, abort);
      },
      abort
    );
  };

  ds.on('data', function(chunk) {
    var handler;

    try {
      chunk = JSON.parse(chunk);
    }
    catch (e) {
      return debug('could not parse chunk: ' + chunk, e);
    }

    // get the handler
    handler = handlers[chunk.type];
    if (typeof handler == 'function') {
      handler(chunk);
    }
  });

  // handle ice candidates
  pc.onicecandidate = handleIceCandidate;

  // listen for the connected state
  pc.oniceconnectionstatechange = checkConnectionState;
};