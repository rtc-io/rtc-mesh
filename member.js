/* jshint node: true */
'use strict';

var async = require('async');
var debug = require('cog/logger')('rtc-mesh-smartpeer');
var defaults = require('cog/defaults');
var detect = require('rtc-core/detect');
var extend = require('cog/extend');
var sig = require('rtc-signaller');
var dcstream = require('rtc-dcstream');
var ScuttleButt = require('scuttlebutt');
var Model = require('scuttlebutt/model');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
  ### RTCMeshMember(attributes, opts)
**/
function RTCMeshMember(opts) {
  if (! (this instanceof RTCMeshMember)) {
    return new RTCMeshMember(opts);
  }

  // init
  EventEmitter.call(this);

  // initialise the opts with the defaults
  this.opts = opts = defaults({}, opts, require('./defaults'));

  // initialise the socket and signaller to null
  this.socket = null;
  this.signaller = null;

  // create a peers array to track existing known peers
  this.peers = [];

  // initialise the channels hash
  this._connections = {};
  this._channels = {};

  // if we have been provided an alternatve scuttlebutt implementation
  // use that
  if (opts.data instanceof ScuttleButt) {
    this.data = opts.data;
  }
  // otherwise create a model, and write and data provided into the model
  else {
    this.data = new Model();

    // TODO: write data
  }

  // inherit the id from our data instance
  this.id = this.data.id;

  // if the data is a scuttlebutt model, then handle data updates
  if (this.data instanceof Model) {
    this.data.on('update', this._handleDataUpdate.bind(this));
  }

  // init internal members
  this._dc = null;

  // initialise the signalling host (fall back to the origin if default not set)
  this.signalhost = opts.signalhost || location.origin;
}

util.inherits(RTCMeshMember, EventEmitter);
module.exports = RTCMeshMember;
var proto = RTCMeshMember.prototype;

/**
  #### announce(data)

  Announce ourselves to the global signaller
**/
proto.announce = function(data) {
  var m = this;
  var socket;

  // if we already have a signaller, simply announce the new data
  // and return
  if (this.signaller) {
    return this.signaller.announce(data);
  }

  // load primus and then carry on
  sig.loadPrimus(this.signalhost, function(err, Primus) {
    if (err) {
      return m.emit('error', err);
    }

    // create the socket
    m._debug('primus loaded, creating new socket to: ' + m.signalhost);
    socket = m.socket = new Primus(m.signalhost);

    socket.once('open', function() {
      // create our internal signaller
      m._debug('socket to signalling server open, creating signaller');
      var signaller = m.signaller = sig(socket);

      // override the signaller id using scuttlebutt's id
      signaller.id = m.data.id;

      // announce ourselves with the data
      signaller.announce(data);

      // when we meet new friends, create a dc:only peer connection
      signaller.on('peer:announce', m._handlePeerAnnounce.bind(m));
      signaller.on('peer:leave', m._handlePeerLeave.bind(m));
      signaller.on('mesh:sdp', m._handleSdp.bind(m));
      signaller.on('mesh:candidates', m._handleCandidates.bind(m));

      // emit the online event
      m.emit('online');
    });

    // when the socket ends, trigger the close event
    m.socket.once('end', m.emit.bind(m, 'close'));
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
  var peer = this;
  this._debug('new data channel available for target: ' + targetId);

  // set the dc binary type to arraybuffer
  dc.binaryType = 'arraybuffer';

  // register the channel
  this._channels[targetId] = dc;

  stream.on('error', function(err) {
    console.log('captured stream error: ', err.message)
  });

  // connect the stream to the data
  // debugger;
  this.data.createReadStream().pipe(stream).pipe(this.data.createWriteStream());
  // stream.pipe(dataStream).pipe(stream);
  this._debug('data synchronization in progress');
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
  var m = this;
  var RTCIceCandidate = (this.opts || {}).RTCIceCandidate ||
    detect('RTCIceCandidate');

  function handleStateChange() {
    if (pc.signalingState === 'stable') {
      pc.removeEventListener('signalingstatechange', handleStateChange);
      m._handleCandidates(srcInfo, candidates);
    }
  }

  // if we don't have a pc connection
  if (! pc) {
    return console.error('received ice candidates from an unknown peer');
  }

  // if the peer connection does not yet have a remote description,
  // wait until the signaling state is stable and then apply the candidates
  if (! pc.remoteDescription) {
    pc.addEventListener('signalingstatechange', handleStateChange);
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
  this.emit('data:update', pairs[0], pairs[1], peer);
};

proto._handleDataSync = function() {
  console.log('synced', arguments);
};

/**
  #### _handlePeer

**/
proto._handlePeerAnnounce = function(data) {
  // ensure the new peer is valid
  var validPeer = data && data.id && (! this._connections[data.id]);
  if (! validPeer) {
    return;
  }

  // create a new connection for the peer
  var pc = this._connections[data.id] = this._initPeerConnection(
    data.id,
    this.signaller.peers.get(data.id)
  );

  // create the peer
  // var peer = this.peers[data.id] = dataslice(this.data, data.id);

  // trigger the peer:join event
  this.emit('peer:join', data);
};

proto._handlePeerLeave = function(id) {

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
  var m = this;

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
        m._negotiate(srcInfo.id, pc, pc.createAnswer);
      }
    },
    fail
  );
};

proto._debug = function(message) {
  var extra = [].slice.call(arguments, 1);

  debug.apply(debug, [this.id + ' ' + message].concat(extra));
};

/**
  #### _initPeerConnection(targetId)

  Create a new `RTCPeerConnection` for the specified target id.  This method
  also handles basic initialization of the peer connection.

**/
proto._initPeerConnection = function(targetId, peerData) {
  var candidates = [];
  var channel = this.signaller.to(targetId);
  var m = this;

  var RTCPeerConnection = (this.opts || {}).RTCPeerConnection ||
    detect('RTCPeerConnection');

  var pc = new RTCPeerConnection(
    // generate the config based on options provided
    defaults({}, (this.opts || {}).config, { iceServers: [] }),

    // generate appropriate connection constraints
    (this.opts || {}).constraints
  );

  this._debug('creating a new connection to ' + targetId);

  // if our role is the master role (roleIdx == 0), then create the
  // data channel
  if (peerData.roleIdx === 0) {
    this.expandMesh(targetId, pc.createDataChannel('rtc-mesh-syncstate'));
    this._negotiate(targetId, pc, pc.createOffer);
  }
  else {
    pc.ondatachannel = function(evt) {
      m.expandMesh(targetId, evt.channel);
    };
  }

  pc.onicecandidate = function(evt) {
    if (evt.candidate) {
      candidates.push(evt.candidate);
    }

    // if we have gathered all the candidates, then batch and send
    if (pc.iceGatheringState === 'complete') {
      m._debug('ice gathering state is completed, sending discovered candidates');
      channel.send('/mesh:candidates', candidates.splice(0));
    }
  };

  pc.oniceconnectionstatechange = function(evt) {
    if (pc.iceConnectionState === 'connected') {
      m._debug('connection active to ' + targetId);
      m.emit('connected', pc);
    }
  };

  return pc;
};

/**
  #### _negotiate(targetId, pc, negotiateFn)

  Used to handle the `createOffer` or `createAnswer` interaction.
**/
proto._negotiate = function(targetId, pc, negotiateFn) {

  var m = this;
  var fail = this.emit.bind(this, 'error');

  function haveDescription(desc) {
    pc.setLocalDescription(
      desc,
      function() {
        m.signaller.to(targetId).send('/mesh:sdp', desc);
      },
      m.emit.bind(m, 'error')
    )
  }

  this._debug('negotiating pc with target ' + targetId);
  negotiateFn.call(pc, haveDescription, fail);
};