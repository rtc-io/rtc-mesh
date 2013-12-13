# rtc-mesh

The `rtc-mesh` module provides functionality that will enable P2P data
mesh to be created and kept in sync (using
[scuttlebutt](https://github.com/dominictarr/scuttlebutt)).

[![experimental](http://hughsk.github.io/stability-badges/dist/experimental.svg)](http://github.com/hughsk/stability-badges)

[![NPM](https://nodei.co/npm/rtc-mesh.png)](https://nodei.co/npm/rtc-mesh/)


## How it works

To be completed.

## Usage

To be completed

## Reference

### join(roomName, opts?, callback)

### use(signalhost)

### RTCSmartPeer(attributes, opts)

#### announce(data)

Announce ourselves to the global signaller

#### close()

#### expandMesh(targetId, dc)

#### getChannel(targetId)

#### getConnection(targetId)

### RTCMesh internal methods

#### _handleDataUpdate(pairs, clock, src)

This is the event handler for the scuttlebutt `update` event.

#### _handlePeer

#### _handleSdp

#### _initPeerConnection(targetId)

Create a new `RTCPeerConnection` for the specified target id.  This method
also handles basic initialization of the peer connection.

#### _negotiate(targetId, pc, negotiateFn)

Used to handle the `createOffer` or `createAnswer` interaction.

## License(s)

### Apache 2.0

Copyright 2013 National ICT Australia Limited (NICTA)

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
