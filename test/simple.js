var mesh = require('..');
var quickconnect = require('rtc-quickconnect');
var test = require('tape');
var roomId = require('uuid').v4();
var joinMesh = require('./helpers/joinmesh');
var members = [];

test('create mesh participant:0', joinMesh(roomId, members));

test('setting a key value triggers a local update', function(t) {
  t.plan(2);

  members[0].once('change', function(key, value) {
    t.equal(key, 'test', 'ok');
    t.equal(value, true, 'ok');
  });

  members[0].set('test', true);
});

test('create mesh participant:1', joinMesh(roomId, members));

test('member:1 syncs', function(t) {
  t.plan(2);

  members[1].once('sync', function() {
    t.pass('sync triggered');
    t.equal(members[1].get('test'), true, 'has test value');
  });
});

test('member:1 catches member:0 change', function(t) {
  t.plan(2);

  members[1].once('change', function(key, value) {
    t.equal(key, 'foo', 'ok');
    t.equal(value, 'bar', 'ok');
  });

  members[0].set('foo', 'bar');
});