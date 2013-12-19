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

  An `RTCMeshMember` instance is returned when you successfully join
  a mesh.  The member instance provides methods that enable to you communicate
  with your fellow peers and a `data` object that is a
  [scuttlebutt Model](https://github.com/dominictarr/scuttlebutt#scuttlebuttmodel)
  instance (by default) that can be used to update the shared mesh data state.

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

  Announce ourselves to the global signaller.  If you used the `join` function
  exported by `rtc-mesh` then this is called for you automatically.  You can,
  however, call the method again if you wish to update any of your signalling
  specific data requires updating.

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
  #### broadcast(streams, opts)

  Broadcast one or more streams to all active peers within the mesh or to
  specified targets within the `opts`.

**/
proto.broadcast = function(streams, opts) {
  // get the targets that we are streaming to
  var targets = (opts || {}).targets || this.peers;
  var m = this;

  // ensure we have an array for streams
  streams = [].concat(streams || []);

  // iterate through the targets, create the negotiation streams as required
  targets.forEach(function(targetId) {
    // request a datastream to the target
    m.to(targetId, { type: 'negotiation' }, function(err, ds) {
    });
  });
};

/**
  #### close()

  Close our connection to the mesh.

**/
proto.close = function() {
  // reset peers
  this.peers = [];

  // close the socket connection
  if (this.socket) {
    this.socket.end();
    this.socket = null;
  }
};

/**
  #### to(targetId, callback)

  Using the dataline between this member and the target, create a stream
  instance that will enable comms.

**/
proto.to = function(targetId, metadata, callback) {
  var dc = this._datalines[targetId];
  var activeStream = this._datastreams[targetId];
  var m = this;
  var dataType;

  if (typeof metadata == 'function') {
    callback = metadata;
    metadata = {};
  }

  // ensure we have default metadata
  metadata = defaults({}, metadata, {
    type: 'text'
  });

  function channelReady() {
    // tell the other end to expect a stream
    dc.send('/stream:' + JSON.stringify(metadata));

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

  function clearActiveStream() {
    activeStream = m._datastreams[targetId] = null;
    m.emit('stream:release', targetId);
  }

  function waitForStreamRelease(releasedId) {
    if (releasedId === targetId) {
      m.removeListener('stream:release', waitForStreamRelease);

      // try again
      m.to(targetId, opts, callback);
    }
  }

  // if we already have an active stream, then report an error
  // TODO: wait for the stream to close and then retry
  if (activeStream) {
    return this.on('stream:release', waitForStreamRelease);
  }

  // if the data channel does not exist, then abort
  if (! dc) {
    return this.once('dataline:' + targetId, function() {
      m.to(targetId, callback);
    });
  }

  // create the stream
  activeStream = m._datastreams[targetId] = dcstream(dc);

  // active stream on the finish
  activeStream.on('finish', clearActiveStream);
  activeStream.on('end', clearActiveStream);

  // wait for open
  if (dc.readyState !== 'open') {
    return dc.addEventListener('open', channelReady);
  }

  channelReady();
};

/**
  ### RTCMesh internal methods
**/

/**
  #### _debug(message)

  Internal debug logging method that attaches our peer id to log messages
**/
proto._debug = function(message) {
  var extra = [].slice.call(arguments, 1);

  debug.apply(debug, [this.id + ' ' + message].concat(extra));
};

/**
  #### _expandMesh(targetId, dc)

  This method is called when we have either created or been notified about
  a new state datachannel for a particular target. The method is responsible
  for propertly connecting our shared `data` instance to the channel to ensure
  that it remains in sync correctly.

**/
proto._expandMesh = function(targetId, dc) {
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
  #### _handleCandidates(candidates, srcInfo)

  This is an event handler that deals with ICE candidates communicated during
  the initial peer connection signalling for the base mesh peer connection.

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
  #### _handlePeerAnnounce

  An event handler for responding to `peer:announce` events from the signaller.
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

  // add this peer to the peers array
  this.peers.push(data.id);

  // trigger the peer:announce event
  this.emit('peer:announce', data);
};

/**
  #### _handlePeerLeave

  An event handler for responding to `peer:leave` events from the signaller.
**/
proto._handlePeerLeave = function(id) {
  // remove the peer from the peers array
  this.peers = this.peers.filter(function(testId) {
    return testId !== id;
  });

  this.emit('peer:leave', id);
};

/**
  #### _handleSdp

  An event handler for reacting to SDP that is sent via the signaller for our
  base mesh peer connection setup.
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

/**
  #### _initDataLine(targetId, dc)

  This method is used to properly initialise the datachannel that will be
  used for sending data streams across to the specified target.  The dataline
  is a separate data channel from the p2p state management channel an is
  designed to be used for adhoc data / file communications between targets.

  To access the dataline of a connection, use the `to` method to get a
  new [rtc-dcstream](https://github.com/rtc-io/rtc-dcstream) stream for
  communicating with the target.
**/
proto._initDataLine = function(targetId, dc) {
  var m = this;
  var activeStream;

  function handleMessage(evt) {
    var parts = (evt && typeof evt.data == 'string') ? evt.data.split(':') : [];
    if (parts[0] === '/stream') {
      activeStream = dcstream(dc);

      if (m._datastreams[targetId]) {
        // TODO: if we have an existing stream from this target, then close it
      }

      // json parse the metadata
      if (parts[1]) {
        try {
          parts[1] = JSON.parse(parts[1]);
        }
        catch (e) {
          // could not decode parts, set to default
          parts[1] = { type: 'text' }
        }
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
    this._initDataLine(targetId, pc.createDataChannel('dataline'));

    // create the synchronization state channel used by scuttlebutt
    this._expandMesh(targetId, pc.createDataChannel('syncstate'));

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
          m._expandMesh(targetId, evt.channel);
          break;
        }

        case 'dataline': {
          m._debug('received dataline from ' + targetId);
          m._initDataLine(targetId, evt.channel);
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

/**
  #### _waitForInitialSync(roomInfo)

  An event handler that is responsible for waiting for a `roominfo` message
  from the signaller. Once the mesh member receives this message it is able
  to determine how many peers it needs to wait for to achieve data
  synchronization.
**/
proto._waitForInitialSync = function(roomInfo) {
  var pendingJoin = roomInfo.memberCount - 1;
  var pendingSync = pendingJoin;
  var m = this;

  function handlePeerAnnounce(data) {
    pendingJoin -= 1;
    m.once('sync:' + data.id, handlePeerSync);

    if (pendingJoin <= 0) {
      m.removeListener('peer:announce', handlePeerAnnounce);
    }
  }

  function handlePeerSync() {
    pendingSync -= 1;
    if (pendingSync <= 0) {
      m.emit('sync');
    }
  }

  this.on('peer:announce', handlePeerAnnounce);
};