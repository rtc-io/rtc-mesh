var util = require('util');
var debug = require('cog/logger')('rtc-mesh-broadcast');
var detect = require('rtc-core/detect');
var defaults = require('cog/defaults');
var extend = require('cog/extend');
var through = require('through');
var EventEmitter = require('events').EventEmitter;
var RTCPeerConnection = detect('RTCPeerConnection');

/**
  ### Broadcast(label, src)

**/
function Broadcast(label, src) {
  if (! (this instanceof Broadcast)) {
    return new Broadcast(label, src);
  }

  EventEmitter.call(this);

  // initialise members
  this.label = label;
  this.src = src;

  // initilaise the inbound and outbound stream
  this._in = null;
  this._out = null;
}

util.inherits(Broadcast, EventEmitter);
module.exports = Broadcast;
var proto = Broadcast.prototype;

Object.defineProperty(proto, 'streams', {
  set: function(value) {
    var pc = this.pc = this._createPeerConnection();

    // add the streams to the peer connection
    [].concat(value || []).forEach(function(stream) {
      pc.addStream(stream);
    });

    // create the offer
    this._createOffer();
  }
});

/**
  #### reader()

  Create a readable stream for that will provide offer handshake information
  that has been collected during the peer connection negotiation.
**/
proto.reader = function() {
  // create the reader
  this._out = through();
  this.emit('outbound', this._out);

  return this._out;
};

/**
  #### writer()

  Create a writer stream for responding to
**/
proto.writer = function() {
  this._in = through();
  this.emit('inbound', this._in);

  return this._in;
};

/**
  #### _createOffer()

  Initiate the createOffer cycle on the peer connection
**/
proto._createOffer = function() {
  // create a duplex stream so we can write to it
  var abort = this._send.bind(this, 'error');
  var bc = this;
  var pc = this.pc;

  function haveOffer(desc) {
    pc.setLocalDescription(
      desc,
      function() {
        bc._send('offer', desc);
      },
      abort
    );
  }

  // create the offer
  debug('attempting to create offer');
  this.pc.createOffer(haveOffer, abort);
};

proto._createPeerConnection = function() {
  var candidates = [];
  var bc = this;

  // get the config
  var config = defaults({}, (this.src.opts || {}).config, {
    iceServers: []
  });

  // create the peer connection
  debug('creating new peer connection');
  var pc = new RTCPeerConnection(config, {
    mandatory: {
      OfferToReceiveVideo: false,
      OfferToReceiveAudio: false
    }
  });

  // when we receive ice candidates, send them over the outbound connection
  pc.onicecandidate = function(evt) {
    if (evt.candidate) {
      candidates.push(evt.candidates);
    }
    else {
      bc._send('candidates', { candidates: candidates });
    }
  };

  return pc;
}

proto._send = function(type, payload) {
  // add the type to the payload
  payload = extend({}, payload, {
    type: type
  });

  if (this._out) {
    return this._out.write(JSON.stringify(payload));
  }

  // if we don't have the outbound stream, then wait
  this.once('outbound', function(stream) {
    stream.write(JSON.stringify(payload));
  });
};