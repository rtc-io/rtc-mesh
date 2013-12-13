var crel = require('crel');
var mesh = require('../');
var friendList;
var friends = {};
var statusBox;

function updateFriend(id, data) {
  var friend = friends[id];

  if (! friend) {
    friend = friends[id] = crel('li', id);
    friendList.appendChild(friend);
  }
}

function watchPeer(peer) {
}

document.body.appendChild(friendList = crel('ul', {
  style: 'float: right; margin: 0;'
}));

// create the statusbox
document.body.appendChild(statusBox = crel('input', {
  type: 'text',
  placeholder: 'My Status',
  value: 'online'
}));

// use the demo rtc.io signalling server
mesh.use('http://rtc.io/switchboard/');

// join the mesh in the friends test room
mesh.join('presencetest', function(err, m) {
  if (err) {
    return console.error('could not connect: ', err);
  }

  // connect to existing peers and wait for new peers to join
  m.peers.forEach(watchPeer);
  m.on('peer:join', watchPeer);

  // m.meshState.on('update', )

  // peer.

  // // handle the data update
  // peer.on('update', function(key, value, source) {
  //   if (key === data.id) {
  //     return;
  //   }

  //   updateFriend(key, value);
  // });

  // // set our status
  // data.set('status', 'online');

  // statusBox.addEventListener('keydown', function(evt) {
  //   setTimeout(function() {
  //     data.set(data.id, { status: evt.target.value });
  //   }, 5);
  // });
});

