var SmartPeer = require('../');
var test = require('tape');
var peer;

test('create a test peer', function(t) {
  t.plan(1);

  peer = new SmartPeer();
  peer.once('announce', function() {
    t.pass('peer announced itself to the global signaller');
  });
});

test('can close the peer', function(t) {
  t.plan(1);
  peer.once('close', function() {
    t.pass('peer closed');
  });

  peer.close();
});
