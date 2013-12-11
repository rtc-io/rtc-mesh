var server = require('http').createServer();
var switchboard = require('rtc-switchboard')(server, { servelib: true });
var port = parseInt(process.env.ZUUL_PORT || process.argv[2], 10) || 3000;

// start the server
server.listen(port, function(err) {
  if (err) {
    return console.log('Encountered error starting server: ', err);
  }

  console.log('test server running on port: ' + port);
});