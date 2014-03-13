# rtc-mesh

__NOTE:__ From version `0.5` onwards `rtc-mesh` is now an
[rtc-quickconnect](https://github.com/rtc-io/rtc-quickconnect) plugin
(which is heaps better and cleaner).

The `rtc-mesh` module provides a way of sharing data between clients using
[scuttlebutt](https://github.com/dominictarr/scuttlebutt).

![unstable](https://img.shields.io/badge/stability-unstable-yellowgreen.svg)

[![NPM](https://nodei.co/npm/rtc-mesh.png)](https://nodei.co/npm/rtc-mesh/)

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
