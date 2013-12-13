var mesh = require('../../');

module.exports = function(roomId, peers) {
  return function(t) {
    t.plan(2);

    // peer b join
    mesh.join(roomId, function(err, p) {
      t.ifError(err);
      t.ok(peers.push(p), 'peer created and online');
    });
  };
};