var mesh = require('..');
var createPeer = require('./helpers/createPeer');
var test = require('tape');
var peers = [];
var roomId = require('uuid').v4();

// mesh.use('http://rtc.io/switchboard/');
// require('cog/logger').enable('rtc-mesh-smartpeer');

test('create peer 0', createPeer(roomId, peers));

test('peer 0 knows about 0 other peers', function(t) {
  t.plan(1);
  peers[0].once('sync', function() {
    t.equal(peers[0].peers.length, 0, 'ok');
  });
});

test('create peer 1', createPeer(roomId, peers));

test('peer 1 and peer 0 know about each other', function(t) {
  t.plan(2);
  peers[1].once('sync', function() {
    t.deepEqual(peers[0].peers, [ peers[1].id ], '0 knows about 1');
    t.deepEqual(peers[1].peers, [ peers[0].id ], '1 knows about 0');
  });
});

test('create peer 2', createPeer(roomId, peers));

test('peers 0, 1 & 2 have knowledge of each other', function(t) {
  t.plan(3);
  peers[2].once('sync', function() {
    t.deepEqual(peers[0].peers, [ peers[1].id, peers[2].id ], 'peer 0 ok');
    t.deepEqual(peers[1].peers, [ peers[0].id, peers[2].id ], 'peer 1 ok');
    t.deepEqual(peers[2].peers, [ peers[0].id, peers[1].id ], 'peer 2 ok');
  });
});

test('peer 0 leave', function(t) {
  t.plan(2);

  peers[2].once('peer:leave', function(id) {
    t.equal(id, peers[0].id, 'peer 2 captured leave event');
  });

  peers[1].once('peer:leave', function(id) {
    t.equal(id, peers[0].id, 'peer 1 captured leave event');
  });

  peers[0].close();
});

test('peer 0 has no peers', function(t) {
  t.plan(1);
  t.equal(peers[0].peers.length, 0, 'ok');
});

test('peers 1 and 2 no longer have knowledge of peer 0', function(t) {
  t.plan(2);
  t.deepEqual(peers[1].peers, [ peers[2].id ], 'peer 1 ok');
  t.deepEqual(peers[2].peers, [ peers[1].id ], 'peer 2 ok');
});