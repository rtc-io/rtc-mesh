# rtc-mesh

The `rtc-mesh` module provides functionality that will enable P2P data
mesh to be created and kept in sync (using
[scuttlebutt](https://github.com/dominictarr/scuttlebutt)).

[![experimental](http://hughsk.github.io/stability-badges/dist/experimental.svg)](http://github.com/hughsk/stability-badges)

[![NPM](https://nodei.co/npm/rtc-mesh.png)](https://nodei.co/npm/rtc-mesh/)


[![browser support](https://ci.testling.com/rtc-io/rtc-mesh.png)](https://ci.testling.com/rtc-io/rtc-mesh)


## How it works

To be completed.

## Usage

To be completed

## Reference

### RTCMesh(attributes, opts)

#### announce(data)

Announce ourselves to the global signaller

#### close()

#### connect(targetAttr)

Open a connection to a participant on the signalling channel that
matches the given attributes.  If there is not currently any peers
available on the signalling server that match the required target
attributes, then the mesh will continue to monitor for new peers that
match the target criteria.

#### expandMesh(datachannel, targetId)

### RTCMesh internal methods

#### _brokerConnection(targetId)

Setup an `RTCPeerConnection` between ourselves and the specified target
mesh endpoint (as specified by the id).

#### _handleEstablish(srcId)

This is the internal handler for dealing with `/establish` commands sent
to this mesh endpoint.

#### _initPeerConnection(targetId)

Create a new `RTCPeerConnection` for the specified target id.  This method
also handles basic initialization of the peer connection.

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
