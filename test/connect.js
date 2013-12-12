var mesh = require('../');
var test = require('tape');
var peerA, peerB;
var roomId = require('uuid').v4();

mesh.use('http://rtc.io/switchboard');
require('cog/logger').enable('*');

test('create peer a', function(t) {
  t.plan(2);

  // join the mesh
  mesh.join(roomId, function(err, p) {
    t.ifError(err);
    t.ok(peerA = p, 'peer a created an online');
  });
});

test('create peer b', function(t) {
  t.plan(2);

  // peer b join
  mesh.join(roomId, function(err, p) {
    t.ifError(err);
    t.ok(peerB = p, 'peer b created and online');
  });
});

test('update peer a data, peer b get\'s update', function(t) {

  t.plan(1);

  function handleSync() {
    console.log(arguments);
  }

  peerB.set('name', 'Bob');
  peerB.on('sync', handleSync);
});