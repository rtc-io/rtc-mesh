# rtc-mesh

The `rtc-mesh` module provides functionality that will enable P2P data
mesh to be created and kept in sync (using
[scuttlebutt](https://github.com/dominictarr/scuttlebutt)).

[![experimental](http://hughsk.github.io/stability-badges/dist/experimental.svg)](http://github.com/hughsk/stability-badges)

[![NPM](https://nodei.co/npm/rtc-mesh.png)](https://nodei.co/npm/rtc-mesh/)

[![Build Status](https://travis-ci.org/rtc-io/rtc-mesh.png?branch=master)](https://travis-ci.org/rtc-io/rtc-mesh)

## How it works

The `rtc-mesh` module works by setting up a data-only WebRTC peer connection
as peers are discovered in a particular room
(using [rtc-signaller](https://github.com/rtc-io/rtc-signaller)).  A node
compatible stream is then wrapped around the stream and we use
[scuttlebutt](https://github.com/dominictarr/scuttlebutt) to keep data in
sync with other peers via the data channel.

## Example Usage

Below is a simple example showing how you can join a mesh, and update the
shared data of the mesh:

```js
var mesh = require('rtc-mesh');

// use the demo rtc.io signalling server
mesh.use('http://rtc.io/switchboard/');

// join the mesh in the friends test room
mesh.join('meshdemo-simple', function(err, m) {
  if (err) {
    return console.error('could not connect: ', err);
  }

  m.data.on('change', function(key, value) {
    console.log('key: ' + key + ', set to: ', value);
  });

  // update the last join time for the shared data
  m.data.set('lastjoin', Date.now());
});


```

## Firefox to Chrome Interop

Tested Chrome 32 <==> Firefox 26 and it works nicely :)

## Reference

### join(roomName, opts?, callback)

This is a helper factory function for creating a new `RTCMeshMember`
instance that will join the specified room for the currently configured
signalling server.

```js
require('rtc-mesh').join('testroom', function(err, m) {
  if (err) {
    return console.error('error connecting: ', err);
  }

  console.log('connected to the mesh, id = ' + m.id);
});
```

### use(signalhost)

If you wish to configure a default signalling server to use, then this can
be done using the `use` function.  For example if you wanted to use the
test rtc.io switchboard for all your connections rather than defaulting to
attmepting to use the same origin that your page was served from, use the
following code:

```js
mesh.use('http://rtc.io/switchboard/');
```

### Broadcast(label, src)

#### _answer(pc, data)

#### _candidates(pc, data)

#### _createOffer()

Initiate the createOffer cycle on the peer connection

### RTCMeshMember(attributes, opts)

An `RTCMeshMember` instance is returned when you successfully join
a mesh.  The member instance provides methods that enable to you communicate
with your fellow peers and a `data` object that is a
[scuttlebutt Model](https://github.com/dominictarr/scuttlebutt#scuttlebuttmodel)
instance (by default) that can be used to update the shared mesh data state.

#### announce(data)

Announce ourselves to the global signaller.  If you used the `join` function
exported by `rtc-mesh` then this is called for you automatically.  You can,
however, call the method again if you wish to update any of your signalling
specific data requires updating.

#### broadcast(streams, opts)

Broadcast one or more streams to all active peers within the mesh or to
specified targets within the `opts`.

#### close()

Close our connection to the mesh.

#### to(targetId, callback)

Using the dataline between this member and the target, create a stream
instance that will enable comms.

### RTCMesh internal methods

#### _debug(message)

Internal debug logging method that attaches our peer id to log messages

#### _expandMesh(targetId, dc)

This method is called when we have either created or been notified about
a new state datachannel for a particular target. The method is responsible
for propertly connecting our shared `data` instance to the channel to ensure
that it remains in sync correctly.

#### _handleCandidates(candidates, srcInfo)

This is an event handler that deals with ICE candidates communicated during
the initial peer connection signalling for the base mesh peer connection.

#### _handlePeerAnnounce

An event handler for responding to `peer:announce` events from the signaller.

#### _handlePeerLeave

An event handler for responding to `peer:leave` events from the signaller.

#### _handleSdp

An event handler for reacting to SDP that is sent via the signaller for our
base mesh peer connection setup.

#### _initDataLine(targetId, dc)

This method is used to properly initialise the datachannel that will be
used for sending data streams across to the specified target.  The dataline
is a separate data channel from the p2p state management channel an is
designed to be used for adhoc data / file communications between targets.

To access the dataline of a connection, use the `to` method to get a
new [rtc-dcstream](https://github.com/rtc-io/rtc-dcstream) stream for
communicating with the target.

#### _initPeerConnection(targetId)

Create a new `RTCPeerConnection` for the specified target id.  This method
also handles basic initialization of the peer connection.

#### _monitorIncomingBroadcasts

This method responds to incoming datastream events and checks to see
if it is a negotiate type stream. If so we need to create a broadcast
receiver.

#### _negotiate(targetId, pc, negotiateFn)

Used to handle the `createOffer` or `createAnswer` interaction.

#### _waitForInitialSync(roomInfo)

An event handler that is responsible for waiting for a `roominfo` message
from the signaller. Once the mesh member receives this message it is able
to determine how many peers it needs to wait for to achieve data
synchronization.

## License(s)

### Apache 2.0

Copyright 2014 National ICT Australia Limited (NICTA)

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
