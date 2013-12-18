var mesh = require('../');
var createPeer = require('./helpers/createPeer');
var test = require('tape');
var peers = [];
var roomId = require('uuid').v4();
var MAX_PEERS = process.env.MAX_PEERS || 4;

// mesh.use('http://rtc.io/switchboard/');
// require('cog/logger').enable('rtc-mesh-smartpeer');

for (var ii = 0; ii < MAX_PEERS; ii++) {
  test('create peer ' + ii, createPeer(roomId, peers));
}

test('all peers get an update for a simple key change', function(t) {
  t.plan(peers.length);

  function handleUpdate(value) {
   //  t.equal(key, 'name', 'Got a name update');
    t.equal(value, 'Bob', 'Name updated to Bob');
  }

  peers.forEach(function(peer) {
    peer.data.once('change:name', handleUpdate);
  });

  peers[0].data.set('name', 'Bob');
});