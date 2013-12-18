/* jshint node: true */
'use strict';

var async = require('async');
var debug = require('cog/logger')('rtc-mesh');
var defaults = require('cog/defaults');
var extend = require('cog/extend');
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
  this._datalines = {};
  this._datastreams = {};

  // if we have been provided an alternatve scuttlebutt implementation
  // use that
  if (opts.data instanceof ScuttleButt) {
    this.data = opts.data;
  }
  // otherwise create a model, and write and data provided into the model
  else {
    this.data = new Model();

    // TODO: write data

    // monitor data changes
  }

  // inherit the id from our data instance
  this.id = this.data.id;

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

      // wait for room info before determining appropriate action
      signaller.once('roominfo', function(data) {
        var isFirst = (! data) || (data.memberCount === 1);

        // if we are the first member, then emit the online trigger immediately
        if (isFirst) {
          return m.emit('sync');
        }

        // otherwise we need to wait for synchronization with the other peers
        m._waitForInitialSync(data);
      });

      // we are online
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
  var reader = this.data.createReadStream();
  var writer = this.data.createWriteStream();

  this._debug('new data channel available for target: ' + targetId);

  // set the dc binary type to arraybuffer
  dc.binaryType = 'arraybuffer';

  // register the channel
  this._channels[targetId] = dc;

  stream.on('error', function(err) {
    console.log('captured stream error: ', err.message)
  });

  // connect the stream to the data
  reader.pipe(stream).pipe(writer);

  // bubble sync events
  writer.on('sync', this.emit.bind(this, 'sync:' + targetId));

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
  #### initDataLine(targetId, dc)
**/
proto.initDataLine = function(targetId, dc) {
  var m = this;
  var activeStream;

  function handleMessage(evt) {
    var parts = (evt && typeof evt.data == 'string') ? evt.data.split(':') : [];
    if (parts[0] === '/stream') {
      activeStream = dcstream(dc);

      if (m._datastreams[targetId]) {
        // TODO: if we have an existing stream from this target, then close it
      }

      // tell the world about our new stream
      m.emit('datastream:' + targetId, activeStream, parts[1]);
      m.emit('datastream', targetId, activeStream, parts[1]);
      m._datastreams[targetId] = activeStream;

      // activeStream.once('end', function() {
      //   console.log('stream ended');
      // });

      // activeStream.once('close', function() {
      //   console.log('stream closed');
      // });

      // activeStream.once('finish', function() {
      //   console.log('stream finished');
      // });
    }
  }

  // set the dc binary type to arraybuffer
  dc.binaryType = 'arraybuffer';

  // listen for messages on the dataline
  dc.addEventListener('message', handleMessage);

  // save a reference to the dataline
  this._datalines[targetId] = dc;

  // trigger the dataline availability event
  this.emit('dataline:' + targetId, dc);
};

/**
  #### to(targetId, callback)

  Using the dataline between this member and the target, create a stream
  instance that will enable comms.

**/
proto.to = function(targetId, opts, callback) {
  var dc = this._datalines[targetId];
  var activeStream = this._datastreams[targetId];
  var m = this;
  var dataType;

  if (typeof opts == 'function') {
    callback = opts;
    opts = {};
  }

  // initialise the datatype
  dataType = (opts || {}).type || 'text';

  function channelReady() {
    // tell the other end to expect a stream
    dc.send('/stream:' + dataType);

    // when the stream finishes, clear the reference
    activeStream.once('finish', function() {
      m._debug('outbound stream to ' + targetId + ' finished');
      if (m._datastreams[targetId] === activeStream) {
        m._debug('released stream reference to: ' + targetId);
        m._datastreams[targetId] = null;
      }
    });

    // create the stream and trigger the callback
    callback(null, activeStream);
  }

  // if we already have an active stream, then report an error
  if (activeStream) {
    return callback(new Error('active stream already open to target: ' + targetId));
  }

  // if the data channel does not exist, then abort
  if (! dc) {
    return this.once('dataline:' + targetId, function() {
      m.to(targetId, callback);
    });
  }

  // create the stream
  activeStream = m._datastreams[targetId] = dcstream(dc);

  // wait for open
  if (dc.readyState !== 'open') {
    return dc.addEventListener('open', channelReady);
  }

  channelReady();
};

/**
  ### RTCMesh internal methods
**/

proto._handleCandidates = function(candidates, srcInfo) {
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
proto._handleSdp = function(desc, srcInfo) {
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
    // create the data line data channel
    this.initDataLine(targetId, pc.createDataChannel('dataline'));

    // create the synchronization state channel used by scuttlebutt
    this.expandMesh(targetId, pc.createDataChannel('syncstate'));

    // negotiate connections
    this._negotiate(targetId, pc, pc.createOffer);
  }
  else {
    pc.ondatachannel = function(evt) {
      var validChannel = evt && evt.channel;
      if (! validChannel) {
        return;
      }

      switch (evt.channel.label) {
        case 'syncstate': {
          m.expandMesh(targetId, evt.channel);
          break;
        }

        case 'dataline': {
          m._debug('received dataline from ' + targetId);
          m.initDataLine(targetId, evt.channel);
        }
      }
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

proto._waitForInitialSync = function(roomInfo) {
  var pendingJoin = roomInfo.memberCount - 1;
  var pendingSync = pendingJoin;
  var m = this;

  function handlePeerJoin(data) {
    pendingJoin -= 1;
    m.once('sync:' + data.id, handlePeerSync);

    if (pendingJoin <= 0) {
      m.removeListener('peer:join', handlePeerJoin);
    }
  }

  function handlePeerSync() {
    pendingSync -= 1;
    if (pendingSync <= 0) {
      m.emit('sync');
    }
  }

  this.on('peer:join', handlePeerJoin);
};