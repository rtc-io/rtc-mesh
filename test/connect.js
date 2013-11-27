var SmartPeer = require('../');
var test = require('tape');
var peerA, peerB;

test('create peer a', function(t) {
  t.plan(1);

  peerA = new SmartPeer();
  peerA.once('announce', function() {
    t.pass('peer announced itself to the global signaller');
  });
});

test('create peer b', function(t) {
  t.plan(1);

  peerB = new SmartPeer();
  peerB.once('announce', function() {
    t.pass('peer announced itself to the global signaller');
  });
});

test('connect a --> b', function(t) {
  t.plan(1);
  peerA.once('connected', function() {
    t.pass('connected');
  });

  peerA.connect({ id: peerB.id });
});

test('connect b --> a fails', function(t) {
  t.plan(1);
  peerB.once('connect:fail', function() {
    t.pass('connection attempt failed as expected');
  });

  peerB.connect({ id: peerA.id });
});