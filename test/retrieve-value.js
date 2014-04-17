var mesh = require('..');
var quickconnect = require('rtc-quickconnect');
var test = require('tape');
var roomId = require('uuid').v4();
var joinMesh = require('./helpers/joinmesh');
var members = [];

test('create mesh participant:0', joinMesh(roomId, members));
test('create mesh participant:1', joinMesh(roomId, members));

test('member:0 has no initial value for "test"', function(t) {
  t.plan(1);
  t.equal(members[0].get('test'), undefined, 'test not defined');
});

test('member:0 will wait for a value for test using "retrieve"', function(t) {
  t.plan(3);

  members[0].retrieve('test', function(err, value) {
    t.ifError(err, 'no error');
    t.equal(value, 'hello', 'value == expected');
  });

  members[1].set('test', 'hello');
  t.equal(members[1].get('test'), 'hello', 'set value for "test" in member:1');
});

test('member:0 will get the currently set value for test using "retrieve"', function(t) {
  t.plan(2);

  members[0].retrieve('test', function(err, value) {
    t.ifError(err, 'no error');
    t.equal(value, 'hello', 'value == expected');
  });
});
