var quickconnect = require('rtc-quickconnect');
var mesh = require('../../');
var Model = require('scuttlebutt/model');

module.exports = function(roomId, members, opts) {
  return function(t) {
    var model;
    var qc;

    t.plan(1);

    qc = quickconnect(window.location.origin, {
      room: roomId
    });

    // create the mesh participant
    members.push(model = mesh(qc, opts));
    t.ok(model instanceof Model, 'successfully created scuttlebutt model');
  };
};