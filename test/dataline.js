var mesh = require('../');
var createPeer = require('./helpers/createPeer');
var test = require('tape');
var peers = [];
var roomId = require('uuid').v4();
var MAX_PEERS = process.env.MAX_PEERS || 4;

mesh.use('http://localhost:3000');
// require('cog/logger').enable('rtc-mesh');

for (var ii = 0; ii < MAX_PEERS; ii++) {
  test('create peer ' + ii, createPeer(roomId, peers));
}


test('can send messages on the dataline from 0 --> 1', function(t) {
  t.plan(3);

  peers[1].once('datastream:' + peers[0].id, function(stream) {
    t.pass('received datastream notification, waiting for data');

    stream.once('data', function(data) {
      t.equal(data, 'hello', 'got expected data');
    });
  });

  peers[0].to(peers[1].id, function(err, stream) {
    t.ifError(err, 'created stream');
    stream.write('hello');
    stream.end('hello2');
  });
});

test('can send new messages on the dataline from 0 --> 1', function(t) {
  t.plan(3);

  peers[1].once('datastream:' + peers[0].id, function(stream) {
    t.pass('received datastream notification, waiting for data');

    stream.once('data', function(data) {
      t.equal(data, 'hello3', 'got expected data');
    });
  });

  peers[0].to(peers[1].id, function(err, stream) {
    t.ifError(err, 'created stream');
    stream.write('hello3');
    stream.end('hello4');
  });
});

// test('all peers get an update for a simple key change', function(t) {
//   t.plan(peers.length);

//   function handleUpdate(value) {
//    //  t.equal(key, 'name', 'Got a name update');
//     t.equal(value, 'Bob', 'Name updated to Bob');
//   }

//   peers.forEach(function(peer) {
//     peer.data.once('change:name', handleUpdate);
//   });

//   peers[0].data.set('name', 'Bob');
// });