var SmartPeer = require('../');
var test = require('tape');
var peer;

require('cog/logger').enable('*');

test('create a test peer', function(t) {
  t.plan(1);

  peer = new SmartPeer();
  peer.events.once('announce', function() {
    t.pass('peer announced itself to the global signaller');
  });
});

test('can close the peer', function(t) {
  t.plan(1);
  peer.events.once('close', function() {
    t.pass('peer closed');
  });

  peer.close();
});
