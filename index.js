/* jshint node: true */
/* global location: false */
'use strict';

var async = require('async');
var debug = require('cog/logger')('rtc-smartpeer');
var defaults = require('cog/defaults');
var detect = require('rtc-core/detect');
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
  EventEmitter.call(this);
  this.socket = null;
  this.id = null;

  // initialise the peers hash
  this.peers = {};

  // initialise the data
  this.data = new Model();

  // init internal members
  this._dc = null;

  // save the opts
  this.opts = opts;

  // initialise the signalling host
  this.signalhost = (opts || {}).signalhost || location.origin ||
    'http://sig.rtc.io:50000';

  // announce ourselves
  this.announce(data);

  this.on('dc', function(channel) {
    debug('data channel available: ' + channel.label);
  });
}

util.inherits(SmartPeer, EventEmitter);
module.exports = SmartPeer;
var proto = SmartPeer.prototype;

/**
  #### announce(data)

  Announce ourselves to the global signaller
**/
proto.announce = function(data) {
  var peer = this;

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

      // inherit the id of the signaller
      peer.id = peer.signaller.id;

      // handle signaller broker messages
      peer.signaller.on('establish', peer._handleEstablish.bind(peer));

      // announce ourselves over the data
      peer.signaller.announce(data);
      peer.emit('announce');
    });

    // when the socket ends, trigger the close event
    peer.socket.on('end', peer.emit.bind(peer, 'close'));
  });
};

proto.close = function() {
  if (this.socket) {
    this.socket.end();
    this.socket = null;
  }
};

proto.connect = function(attr) {
  var peer = this;
  var match = matcher(attr);

  // initialise the processing queue (one at a time please)
  var q = async.queue(function(task, cb) {
    // if the task has no operation, then trigger the callback immediately
    if (typeof task.op != 'function') {
      return cb();
    }

    // process the task operation
    task.op(task, cb);
  }, 1);

  function checkNewPeer(data) {
    // check the new peer to see if it matches the requirements
    debug('new peer announced with attr: ', data);
    if (match(data)) {
      q.push({ op: request });
    }
  }

  function request(task, cb) {
    // go looking for a matching target
    debug('making request for peer with attr: ', attr);
    peer.signaller.request(attr, function(err, channel) {
      if (err) {
        return cb(err);
      }

      peer.signaller.removeListener('announce', checkNewPeer);
      debug('found target peer, initializing peer connection');

      // broker the connection
      peer._brokerConnection(channel.targetId);
    });
  }

  if (! this.socket) {
    return this.once('announce', function() {
      peer.connect(attr, callback);
    });
  }

  // when new peers are announced look for a match
  this.signaller.on('announce', checkNewPeer);
  q.push({ op: request });
};

proto.expandMesh = function(dc, targetId) {
  var peer = this;

  function ready() {
    peer.emit('participant', dc, targetId);
  }

  // if the dc ready state is open, trigger the new dc event now
  if (dc.readyState === 'open') {
    ready();
  }
  else {
    dc.onopen = ready;
  }
}

proto._brokerConnection = function(targetId) {
  // create a pc for datachannel only traffic
  var channel = this.signaller.to(targetId);
  var pc;
  var peer = this;

  // initialise session description and icecandidate objects
  var RTCSessionDescription = (this.opts || {}).RTCSessionDescription ||
    detect('RTCSessionDescription');

  function abort(err) {
    debug('failed brokering peerconnection: ', err);
  }

  function establishFail() {
    peer.emit('connect:fail');
    removeListeners();
  }

  function establishOK(sourceId) {
    if (sourceId === targetId) {
      debug('got establish:ok confirmation from: ' + sourceId);
      removeListeners();

      // create the new pc
      pc = peer._initPeerConnection(targetId);

      // create the sync flow data channel
      peer.expandMesh(pc.createDataChannel('syncflow'), targetId);

      // create the offer
      pc.createOffer(gotOffer, abort);
    }
  }

  function gotOffer(desc) {
    pc.setLocalDescription(desc, function() {
      channel.send('/broker:offer:' + peer.id, desc);
    }, abort);

    peer.signaller.once('broker:answer:' + targetId, function(desc) {
      debug('got answer sdp from: ' + targetId);
      pc.setRemoteDescription(new RTCSessionDescription(desc), function() {
        debug('successfully set remote description for the offerer');
      }, abort);
    });
  }

  function removeListeners() {
    peer.signaller.removeListener('establish:ok', establishOK);
    peer.signaller.removeListener('establish:fail', establishFail);
  }

  // send the establish request
  channel.send('/establish', this.id);
  this.signaller.on('establish:ok', establishOK);
  this.signaller.on('establish:fail', establishFail);
};

proto._handleEstablish = function(srcId) {
  var channel = this.signaller.to(srcId);
  var peer = this;
  var pc;

  // initialise session description and icecandidate objects
  var RTCSessionDescription = (this.opts || {}).RTCSessionDescription ||
    detect('RTCSessionDescription');

  function abort(err) {
    debug('failed brokering peerconnection: ', err);
  }

  function createAnswer() {
    pc.createAnswer(gotAnswer, abort);
  }

  function gotAnswer(desc) {
    pc.setLocalDescription(desc, function() {
      channel.send('/broker:answer:' + peer.id, desc);
    }, abort);
  }

  debug('received establish request from source id: ' + srcId);

  if (this.peers[srcId]) {
    debug('connection active to: ' + srcId + ', sending fail');
    return channel.send('/establish:fail');
  }

  this.signaller.once('broker:offer:' + srcId, function(desc) {
    debug('got offer sdp from ' + srcId);
    pc = peer._initPeerConnection(srcId);
    pc.ondatachannel = function(evt) {
      peer.expandMesh(evt.channel, srcId);
    };

    pc.setRemoteDescription(
      new RTCSessionDescription(desc),
      createAnswer,
      abort
    );
  });

  channel.send('/establish:ok', this.id);
};

proto._initPeerConnection = function(targetId) {
  var candidates = [];
  var channel = this.signaller.to(targetId);
  var peer = this;

  var RTCPeerConnection = (this.opts || {}).RTCPeerConnection ||
    detect('RTCPeerConnection');

  var RTCIceCandidate = (this.opts || {}).RTCIceCandidate ||
    detect('RTCIceCandidate');

  var pc = this.peers[targetId] = new RTCPeerConnection(
    // generate the config based on options provided
    defaults({}, (this.opts || {}).config, { iceServers: [] }),

    // generate appropriate connection constraints
    (this.opts || {}).constraints
  );

  // handle candidates getting passed across
  this.signaller.on('broker:candidates:' + targetId, function(candidates) {
    candidates.forEach(function(candidate) {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    });
  });

  pc.onicecandidate = function(evt) {
    if (evt.candidate) {
      candidates.push(evt.candidate);
    }

    // if we have gathered all the candidates, then batch and send
    if (pc.iceGatheringState === 'complete') {
      debug('ice gathering state is completed, sending discovered candidates');
      channel.send('/broker:candidates:' + peer.id, candidates.splice(0));
    }
  };

  pc.oniceconnectionstatechange = function(evt) {
    if (pc.iceConnectionState === 'connected') {
      peer.emit('connected');
    }
  };

  return pc;
};