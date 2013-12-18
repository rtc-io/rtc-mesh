var mesh = require('../');
var createPeer = require('./helpers/createPeer');
var test = require('tape');
var peers = [];
var roomId = require('uuid').v4();
var MAX_PEERS = process.env.MAX_PEERS || 4;

// mesh.use('http://rtc.io/switchboard/');
// require('cog/logger').enable('rtc-mesh-smartpeer');

test('create peer 0', createPeer(roomId, peers));
test('peer 0 sync', function(t) {
  t.plan(1);
  peers[0].once('sync', t.pass.bind(t, 'got sync'));
});

test('create peer 1', createPeer(roomId, peers));
test('peer 1 sync', function(t) {
  t.plan(1);
  peers[1].once('sync', t.pass.bind(t, 'got sync'));
});

test('create peer 2', createPeer(roomId, peers));
test('peer 2 sync', function(t) {
  t.plan(1);
  peers[2].once('sync', t.pass.bind(t, 'got sync'));
});

test('create peer 3', createPeer(roomId, peers));
test('peer 3 sync', function(t) {
  t.plan(1);
  peers[3].once('sync', t.pass.bind(t, 'got sync'));
});
