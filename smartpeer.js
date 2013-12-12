/* jshint node: true */
'use strict';

var async = require('async');
var debug = require('cog/logger')('rtc-mesh-smartpeer');
var defaults = require('cog/defaults');
var detect = require('rtc-core/detect');
var extend = require('cog/extend');
var sig = require('rtc-signaller');
var dcstream = require('rtc-dcstream');
var Model = require('scuttlebutt/model');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
  ### RTCSmartPeer(attributes, opts)
**/
function RTCSmartPeer(attributes, opts) {
  if (! (this instanceof RTCSmartPeer)) {
    return new RTCSmartPeer(opts);
  }

  // init
  EventEmitter.call(this);

  // initialise the opts with the defaults
  this.opts = opts = defaults({}, opts, require('./defaults'));

  // initialise the socket and signaller to null
  this.socket = null;
  this.signaller = null;

  // initialise the channels hash
  this._connections = {};
  this._channels = {};

  // initialise the data
  this.data = new Model();

  // patch in the get and set methods directly into the peer
  this.id = this.data.id;
  this.get = this.data.get.bind(this.data);
  this.set = this.data.set.bind(this.data);

  // trigger update events on the smartpeer when the data changes
  this.data.on('update', this._handleDataUpdate.bind(this));
  this.data.on('sync', this._handleDataSync.bind(this));

  // init internal members
  this._dc = null;

  // initialise the signalling host (fall back to the origin if default not set)
  this.signalhost = opts.signalhost || location.origin;
}

util.inherits(RTCSmartPeer, EventEmitter);
module.exports = RTCSmartPeer;
var proto = RTCSmartPeer.prototype;

/**
  #### announce(data)

  Announce ourselves to the global signaller
**/
proto.announce = function(data) {
  var peer = this;
  var socket;

  // if we already have a signaller, simply announce the new data
  // and return
  if (this.signaller) {
    return this.signaller.announce(data);
  }

  // load primus and then carry on
  sig.loadPrimus(this.signalhost, function(err, Primus) {
    if (err) {
      return peer.emit('error', err);
    }

    // create the socket
    debug('primus loaded, creating new socket to: ' + peer.signalhost);
    socket = peer.socket = new Primus(peer.signalhost);

    socket.once('open', function() {
      // create our internal signaller
      debug('socket to signalling server open, creating signaller');
      var signaller = peer.signaller = sig(socket);

      // override the signaller id using scuttlebutt's id
      signaller.id = peer.data.id;

      // announce ourselves with the data
      signaller.announce(data);

      // when we meet new friends, create a dc:only peer connection
      signaller.on('peer:announce', peer._handlePeer.bind(peer));
      signaller.on('mesh:sdp', peer._handleSdp.bind(peer));
      signaller.on('mesh:candidates', peer._handleCandidates.bind(peer));

      // emit the online event
      peer.emit('online');
    });

    // when the socket ends, trigger the close event
    peer.socket.once('end', peer.emit.bind(peer, 'close'));
  });
};

/**
  #### close()
**/
proto.close = function() {
  if (this.socket) {
    this.socket.end();
    this.socket = null;
  }
};

/**
  #### expandMesh(targetId, dc)
**/
proto.expandMesh = function(targetId, dc) {
  // create a new stream
  var stream = dcstream(dc);

  // create a new stream for scuttlebutt synchronization
  var dataStream = this.data.createStream();
  debug('new data channel available for target: ' + targetId);

  // set the dc binary type to arraybuffer
  dc.binaryType = 'arraybuffer';

  // register the channel
  this._channels[targetId] = dc;

  stream.on('error', function(err) {
    console.log('captured stream error: ', err.message)
  });

  // connect the stream to the data
  // debugger;
  stream.pipe(dataStream).pipe(stream);
  debug('data synchronization in progress');
};

/**
  #### getChannel(targetId)
**/
proto.getChannel = function(targetId) {
  return this._channels[targetId];
};

/**
  #### getConnection(targetId)
**/
proto.getConnection = function(targetId) {
  return this._connections[targetId];
};

/**
  ### RTCMesh internal methods
**/

proto._handleCandidates = function(srcInfo, candidates) {
  var pc = srcInfo && this._connections[srcInfo.id]
  var retry = this._handleCandidates.bind(this, srcInfo, candidates);
  var RTCIceCandidate = (this.opts || {}).RTCIceCandidate ||
    detect('RTCIceCandidate');

  // if we don't have a pc connection
  if (! pc) {
    return console.error('received ice candidates from an unknown peer');
  }

  // if the peer connection does not yet have a remote description,
  // wait until the signaling state is stable and then apply the candidates
  if (! pc.remoteDescription) {
    return this.once('stable', retry);
  }

  // apply the candidates
  (candidates || []).forEach(function(candidate) {
    pc.addIceCandidate(new RTCIceCandidate(candidate));
  });
};

/**
  #### _handleDataUpdate(pairs, clock, src)

  This is the event handler for the scuttlebutt `update` event.
**/
proto._handleDataUpdate = function(pairs, clock, src) {
  var peer = this.signaller.peers.get(src) || this;

  this.emit('update', pairs[0], pairs[1], peer);
};

proto._handleDataSync = function() {
  console.log('synced', arguments);
};

/**
  #### _handlePeer

**/
proto._handlePeer = function(data) {
  // ensure the new peer is valid
  var validPeer = data && data.id && (! this._connections[data.id]);

  if (! validPeer) {
    return;
  }

  // create a new connection for the peer
  debug(this.id + ' creating a new connection to ' + data.id);
  this._connections[data.id] = this._initPeerConnection(
    data.id,
    this.signaller.peers.get(data.id)
  );
};

/**
  #### _handleSdp

**/
proto._handleSdp = function(srcInfo, desc) {
  // initialise session description and icecandidate objects
  var fail = this.emit.bind(this, 'error');
  var RTCSessionDescription = (this.opts || {}).RTCSessionDescription ||
    detect('RTCSessionDescription');
  var pc = srcInfo && this._connections[srcInfo.id];
  var peer = this;

  // if we don't have a pc connection
  if (! pc) {
    return console.error('received sdp for an unknown peer');
  }

  // set the remote description of the pc
  pc.setRemoteDescription(
    new RTCSessionDescription(desc),
    function() {
      // if it was an offer, then create an answer
      if (desc.type == 'offer') {
        peer._negotiate(srcInfo.id, pc, pc.createAnswer);
      }
    },
    fail
  );
};

/**
  #### _initPeerConnection(targetId)

  Create a new `RTCPeerConnection` for the specified target id.  This method
  also handles basic initialization of the peer connection.

**/
proto._initPeerConnection = function(targetId, peerData) {
  var candidates = [];
  var channel = this.signaller.to(targetId);
  var peer = this;

  var RTCPeerConnection = (this.opts || {}).RTCPeerConnection ||
    detect('RTCPeerConnection');

  var pc = new RTCPeerConnection(
    // generate the config based on options provided
    defaults({}, (this.opts || {}).config, { iceServers: [] }),

    // generate appropriate connection constraints
    (this.opts || {}).constraints
  );

  // if our role is the master role (roleIdx == 0), then create the
  // data channel
  if (peerData.roleIdx === 0) {
    this.expandMesh(targetId, pc.createDataChannel('rtc-mesh-syncstate'));
    this._negotiate(targetId, pc, pc.createOffer);
  }
  else {
    pc.ondatachannel = function(evt) {
      peer.expandMesh(targetId, evt.channel);
    };
  }

  pc.onicecandidate = function(evt) {
    if (evt.candidate) {
      candidates.push(evt.candidate);
    }

    // if we have gathered all the candidates, then batch and send
    if (pc.iceGatheringState === 'complete') {
      debug('ice gathering state is completed, sending discovered candidates');
      channel.send('/mesh:candidates', candidates.splice(0));
    }
  };

  pc.onsignalingstatechange = function(evt) {
    peer.emit(pc.signalingState);
  };

  pc.oniceconnectionstatechange = function(evt) {
    if (pc.iceConnectionState === 'connected') {
      peer.emit('connected');
    }
  };

  return pc;
};

/**
  #### _negotiate(targetId, pc, negotiateFn)

  Used to handle the `createOffer` or `createAnswer` interaction.
**/
proto._negotiate = function(targetId, pc, negotiateFn) {

  var peer = this;
  var fail = this.emit.bind(this, 'error');

  function haveDescription(desc) {
    pc.setLocalDescription(
      desc,
      function() {
        peer.signaller.to(targetId).send('/mesh:sdp', desc);
      },
      peer.emit.bind(peer, 'error')
    )
  }

  debug(this.id + ' negotiating pc with target ' + targetId);
  negotiateFn.call(pc, haveDescription, fail);
};