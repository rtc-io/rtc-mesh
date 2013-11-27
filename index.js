/* jshint node: true */
/* global location: false */
'use strict';

var debug = require('cog/logger')('rtc-smartpeer');
var extend = require('cog/extend');
var signaller = require('rtc-signaller');
var matcher = require('rtc-signaller/matcher');
var Model = require('scuttlebutt/model');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

function SmartPeer(data, opts) {
  if (! (this instanceof SmartPeer)) {
    return new SmartPeer(opts);
  }

  // init
  Model.call(this);
  this.socket = null;

  // create an events interface for local events
  this.events = new EventEmitter();

  // initialise the signalling host
  this.signalhost = (opts || {}).signalhost || location.origin ||
    'http://sig.rtc.io:50000';

  // announce ourselves
  this.announce(data);
}

util.inherits(SmartPeer, Model);
module.exports = SmartPeer;
var proto = SmartPeer.prototype;

/**
  #### announce(data)

  Announce ourselves to the global signaller
**/
proto.announce = function(data) {
  var peer = this;

  // ensure the data contains the id of the model
  data = extend({}, data, {
    id: this.id
  });

  // load primus and then carry on
  signaller.loadPrimus(function(err, Primus) {
    if (err) {
      return peer.emit('error', err);
    }

    // create the socket
    debug('primus loaded, creating new socket to: ' + peer.signalhost);
    peer.socket = new Primus(peer.signalhost);

    peer.socket.on('open', function() {
      // create our internal signaller
      debug('socket to signalling server open, creating signaller');
      peer.signaller = signaller(peer.socket);

      // announce ourselves over the data
      peer.signaller.announce(data);
      peer.events.emit('announce');
    });

    // when the socket ends, trigger the close event
    peer.socket.on('end', peer.events.emit.bind(peer.events, 'close'));
  });
};

proto.close = function() {
  if (this.socket) {
    this.socket.end();
    this.socket = null;
  }
};

proto.connect = function(attr, callback) {
  var peer = this;
  var match = matcher(attr);

  function request() {
    // go looking for a matching target
    this.signaller.request(attr, function(err, channel) {
      if (err && (! err.timeout)) {
        return callback(err);
      }
      else if (! err) {
        console.log('found target peer');
      }
    });
  }

  if (! this.socket) {
    return this.once('announce', function() {
      peer.connect(attr, callback);
    });
  }

  // when new peers are announced look for a match
  this.signaller.on('announce', function(data) {
    // check the new peer to see if it matches the requirements
    if (match(data)) {
      request();
    }
  });

  request();
};