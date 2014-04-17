# rtc-mesh

__NOTE:__ From version `0.5` onwards `rtc-mesh` is now an
[rtc-quickconnect](https://github.com/rtc-io/rtc-quickconnect) plugin
(which is heaps better and cleaner).

The `rtc-mesh` module provides a way of sharing data between clients using
[scuttlebutt](https://github.com/dominictarr/scuttlebutt).


[![NPM](https://nodei.co/npm/rtc-mesh.png)](https://nodei.co/npm/rtc-mesh/)

![unstable](https://img.shields.io/badge/stability-unstable-yellowgreen.svg)
[![Build Status](https://img.shields.io/travis/rtc-io/rtc-mesh.svg?branch=master)](https://travis-ci.org/rtc-io/rtc-mesh)

## Simple Example

```js
var quickconnect = require('rtc-quickconnect');
var mesh = require('rtc-mesh');

// initialise the connection
var qc = quickconnect('http://rtc.io/switchboard', {
  room: 'meshdemo-simple'
});

// create the model
var model = mesh(qc);

// report data change events
model.on('change', function(key, value) {
  console.log('captured change key: "' + key + '" set to ', value);
});

model.set('lastjoin', Date.now());
```

## Using Scuttlebutt Subclasses

Here's an example using
[CRDT](https://github.com/dominictarr/crdt):

```js
var quickconnect = require('rtc-quickconnect');
var mesh = require('rtc-mesh');
var Doc = require('crdt').Doc;
var uuid = require('uuid');

// initialise the connection
var qc = quickconnect('http://rtc.io/switchboard', {
  room: 'meshdemo-crdt'
});

// create the model
var model = mesh(qc, { model: new Doc() });

model.on('add', function(row) {
  console.log('new row created: ', row);
});

model.add({ id: uuid.v4(), name: 'Fred' });
```

## Synchronizing Multiple Datasets

It's also possible to create invoke multiple meshes on a single data
channel using custom channel names (by default the a channel is created with
the name of `mesh`).

```js
var quickconnect = require('rtc-quickconnect');
var mesh = require('rtc-mesh');

// initialise the connection
var qc = quickconnect('http://rtc.io/switchboard', {
  room: 'meshdemo-multichannel'
});

// create the models
var modelA = mesh(qc, { channelName: 'm1' });
var modelB = mesh(qc, { channelName: 'm2' });

// report data change events
modelA.on('change', function(key, value) {
  console.log('captured change for item in a: ', arguments);
});

modelB.on('change', function(key, value) {
  console.log('captured change for item in b: ', arguments);
})

// update some keys
modelA.set('lastjoin', Date.now());
modelB.set('lastRandom', (Math.random() * 10000) | 0);
```

## Reference

### mesh

```
mesh(qc, opts?) => Model
```

As displayed in the examples, the `mesh` function expects to be passed a
[quickconnect](https://github.com/rtc-io/rtc-quickconnect) created signaller. Using
this object, it will create a data channel that will be responsible for sharing
[scuttlebutt](https://github.com/dominictarr/scuttlebutt) model information with peers.

In addition to the functions exposed by a scuttlebutt Model, the following helpers
have also been added:

#### retrieve

```
retrieve(key, callback)
```

Get the value of the specified key and pass the result back through the
provided `callback` (node error first style).  If the value is already
available in the local Model, then the callback will be triggered immediately.
If not, the callback will be triggered once the value has been set in the
local Model.

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
