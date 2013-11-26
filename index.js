/* jshint node: true */
'use strict';

var async = require('async');
var debug = require('cog/logger')('rtc-smartpeer');
var extend = require('cog/extend');
var state = require('state');
var uuid = require('uuid');

/**
  # rtc-smartpeer

  An experimental interface for working with RTCPeerConnection with the
  assistance of [state.js](http://statejs.org/).

**/

// TODO: move to using addEventListener once ff supports this consistently
module.exports = function(pc, signaller, opts) {

  var index = parseInt((opts || {}).index, 10) || 0;
  var channel;
  var role = null;

  // initialise the processing queue (one at a time please)
  var q = async.queue(function(task, cb) {
    // if the task has no operation, then trigger the callback immediately
    if (typeof task.op != 'function') {
      return cb();
    }

    // process the task operation
    task.op(task, cb);
  }, 1);

  function abort(cb) {
    return function(err) {
      debug('captured error: ', err);

      if (typeof cb == 'function') {
        cb(err);
      }
    };
  }

  function connect(task, cb) {
    var methodName = 'createOffer';

    // if we have the role of slave, then abort
    if (role !== 'master') {
      debug('not master, cannot initiate connection');
      return cb();
    }

    // create the offer
    debug('creating offer');
    pc.createOffer(
      function(desc) {

        // // if a filter has been specified, then apply the filter
        // if (typeof sdpFilter == 'function') {
        //   desc.sdp = sdpFilter(desc.sdp, conn, methodName);
        // }

        // initialise the local description
        pc.setLocalDescription(
          desc,

          // if successful, then send the sdp over the wire
          function() {
            // send the sdp
            channel.send('/sdp:' + index, {
              sdp: desc.sdp,
              type: desc.type
            });

            // clear the block
            cb();
          },

          // on error, abort
          abort(cb)
        );
      },

      // on error, abort
      abort(cb)
    );
  }

  function checkSignalingState() {
    // update the state of the connection to the specified signalling state
    debug('got signaling state change: ' + pc.signalingState);
    pc.state('-> ' + pc.signalingState);
  }

  function determineRole(task, cb) {
    // send our id across the wire
    signaller.once('remoteid', function(remoteId) {
      role = signaller.id > remoteId ? 'master' : 'slave';
      debug('signaller ' + signaller.id + ' role determined: ' + role);
      cb();
    });

    channel.send('/remoteid', signaller.id);
  }

  // race to get an offer lock on the channel
  function lock(task, cb) {
    if (remoteLock) {
      return channel.once('/unlock', function() {
        lock(task, cb);
      });
    }

    channel.send('/lock')
  }

  function openChannel(task, cb) {
    // request a signalling connnection
    signaller.request(task.attr, function(err, chan) {
      if (err) {
        return cb(err);
      }

      cb(null, channel = chan);
    });
  }

  function pair(attr) {
    targetAttr = attr;
  }

  function remoteSdp(data, cb) {
    debug('setting remote description for pc');

    pc.setRemoteDescription(
      new RTCSessionDescription({ sdp: data.sdp, type: data.type }),
      cb,
      abort(cb)
    );
  }

  function rollbackOffer(task, cb) {
    pc.setLocalDescription(
      { type: 'rollback' },
      cb,
      abort(cb)
    );
  }

  function renegotiate() {
    debugger;
  }

  // if no signaller has been provided then throw an error
  if (! signaller) {
    throw new Error('A signaller is required to create a smart peer');
  }

  // start monitoring the peer connection
  pc.onsignalingstatechange = checkSignalingState;

  // handle negotiation needed events
  pc.onnegotiationneeded = renegotiate;

  // bind signaller events
  signaller.on('sdp:' + index, function(data) {
    pc.remoteSdp(data);
  });

  // initiate the state management component using statejs (see statejs.org)
  state(pc, {
    /**
    #### stable
    **/
    stable: state('initial', {
      connect: function(attr) {
        // open a channel and determine the role
        q.push({ attr: attr, op: openChannel });
        q.push({ op: determineRole });
        q.push({ op: connect });
      },

      remoteSdp: function(data) {
        q.push(extend(data, { op: remoteSdp }));
      },

      /**
      #### have-local-offer
      **/
      'have-local-offer': state({
        remoteSdp: function(data) {
          if (data.type == 'offer' && exchangeId < data.uuid) {
            debug('ignoring remote offer, lost exchange battle');
            return;
          }
          else if (data.type == 'offer') {
            debug('need to rollback local offer');
            q.push({ op: rollbackOffer });
          }

          // TODO: inherit lower level state implementation
          q.push(extend(data, { op: remoteSdp }));
          q.push()
        }
      }),

      /**
      ### have-local-answer
      **/
      'have-local-answer': state({

      })
    })
  });

  // move the peer connection into the appropriate state
  pc.state('-> ' + pc.signalingState);

  return pc;
};