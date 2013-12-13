var mesh = require('../');
var createPeer = require('./helpers/createPeer');
var test = require('tape');
var peers = [];
var roomId = require('uuid').v4();
var MAX_PEERS = process.env.MAX_PEERS || 4;

// mesh.use('http://localhost:3000');
// require('cog/logger').enable('rtc-mesh-smartpeer');

for (var ii = 0; ii < MAX_PEERS; ii++) {
  test('create peer ' + ii, createPeer(roomId, peers));
}

test('all peers get an update for a simple key change', function(t) {
  t.plan(peers.length * 2);

  function handleUpdate(key, value) {
    t.equal(key, 'name', 'Got a name update');
    t.equal(value, 'Bob', 'Name updated to Bob');
  }

  peers.forEach(function(peer) {
    peer.once('data:update', handleUpdate);
  });

  peers[0].data.set('name', 'Bob');
});