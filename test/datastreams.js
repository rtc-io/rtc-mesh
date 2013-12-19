var mesh = require('..');
var createPeer = require('./helpers/createPeer');
var test = require('tape');
var peers = [];
var roomId = require('uuid').v4();

mesh.use('http://rtc.io/switchboard/');
// require('cog/logger').enable('rtc-mesh-smartpeer');

test('create peer 0', createPeer(roomId, peers));
test('wait for peer 0 sync', function(t) {
  t.plan(1);
  peers[0].once('sync', t.pass.bind(t, 'ok'));
});

test('create peer 1', createPeer(roomId, peers));
test('wait for peer 1 sync', function(t) {
  t.plan(1);
  peers[1].once('sync', t.pass.bind(t, 'ok'));
});

test('request a datastream from 0 --> 1', function(t) {
  t.plan(4);
  peers[0].to(peers[1].id, function(err, ds) {
    t.ifError(err, 'successfully created datastream');

    ds.end('hello');
  });

  peers[1].once('datastream:' + peers[0].id, function(ds) {
    t.ok(ds, 'peer 1 received datastream request from peer 0');

    ds.on('data', function(chunk) {
      t.equal(chunk.toString(), 'hello', 'received message as expected');
    });

    ds.on('end', function() {
      t.pass('captured stream end');
    });
  });
});

test('two concurrent ds requests (0 ==> 1) work, 2nd request waits', function(t) {
  t.plan(2);

  peers[0].to(peers[1].id, function(err, ds) {
    t.ifError(err, 'conn 1 ok');

    ds.end('hello and goodbye');
  });

  peers[0].to(peers[1].id, function(err, ds) {
    t.ifError(err, 'conn 2 ok');

    ds.end('hello and goodbye');
  });
});