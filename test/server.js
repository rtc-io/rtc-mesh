var http = require('http');

module.exports = function() {
  var server = http.createServer();
  var switchboard = require('rtc-switchboard')(server, { servelib: true });

  return server;
};
