var smartPeer = require('..');
var messenger = require('messenger-memory');
var signaller = require('rtc-signaller');
var test = require('tape');
var rtc = require('rtc');
var conns = [];
var signallers = [];
var monitors = [];

require('cog/logger').enable('*');

var dcConstraints = {
  optional: [
    { RtpDataChannels: true }
  ]
};

test('create peer connections', function(t) {
  t.plan(2);

  t.ok(conns[0] = rtc.createConnection({}, dcConstraints), 'created a');
  t.ok(conns[1] = rtc.createConnection({}, dcConstraints), 'created b');
});

test('create signallers', function(t) {
  t.plan(2);

  t.ok(signallers[0] = signaller(messenger()), 'created signaller a');
  t.ok(signallers[1] = signaller(messenger()), 'created signaller b');
});

test('create smart peers', function(t) {
  t.plan(conns.length * 2);

  conns.forEach(function(conn, index) {
    smartPeer(conn, signallers[index]);
    t.equal(typeof conn.state, 'function');
    t.ok(conn.state() == 'stable', 'peer connection inactive');
  });
});

test('connect a <--> b', function(t) {
  t.plan(conns.length);

  conns.forEach(function(pc, index) {
    pc.addEventListener('connect', function handleConnect() {
      pc.removeEventListener('connect', handleConnect);
      t.pass('connection ' + index + ' active');
    });

    setTimeout(function() {
      pc.connect({ id: signallers[index ^ 1].id });
    }, 10);
  });
});

// test('couple a --> b', function(t) {
//   t.plan(1);

//   t.ok(
//     monitors[0] = couple(conns[0], { id: signallers[1].id }, signallers[0]),
//     'ok'
//   );
// });

// test('couple b --> a', function(t) {
//   t.plan(1);
//   t.ok(
//     monitors[1] = couple(conns[1], { id: signallers[0].id }, signallers[1]),
//     'ok'
//   );
// });

// test('activate connection', function(t) {
//   t.plan(monitors.length);

//   monitors.forEach(function(mon, index) {
//     mon.once('active', t.pass.bind(t, 'connection ' + index + ' active'));
//   });

//   monitors[0].createOffer();
// });

// test('create a data channel on a', function(t) {
//   t.plan(2);

//   conns[1].addEventListener('datachannel', function(evt) {
//     t.pass('got data channel');
//   });

//   t.ok(
//     conns[0].createDataChannel('RTCDataChannel', { reliable: false }),
//     'a created'
//   );
// });

// test('close connections', function(t) {
//   t.plan(2);

//   a.once('close', t.pass.bind(t, 'a closed'));
//   b.once('close', t.pass.bind(t, 'b closed'));

//   a.close();
//   b.close();
// });