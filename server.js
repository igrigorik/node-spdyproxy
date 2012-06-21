var spdy = require('spdy'),
    http = require('http'),
    url = require('url'),
    net = require('net'),
    fs = require('fs');

process.on('uncaughtException', function(e) {
  console.error('Error: ' + e);
});

function logRequest(req) {
  console.log(req.method + ' ' + req.url);
  for (var i in req.headers)
    console.log(' * ' + i + ': ' + req.headers[i]);
}

function handlePlain(req, res) {
  logRequest(req);

  var requestOptions = {
    host: req.headers.host,
    port: req.headers.host.split(':')[1] || 80,
    path: req.url,
    method: req.method,
    headers: req.headers // TODO: remove, host, method, etc?
  };

  var rreq = http.request(requestOptions, function(rres) {
    delete rres.headers['transfer-encoding'];
    rres.headers['x-spdy-proxy'] = 'v1.0.0';

    // write out headers to handle redirects
    res.writeHead(rres.statusCode, '', rres.headers);
    rres.pipe(res);
  });

  rreq.on('error', function(e) {
    console.log("Client error: " + e.message);
    res.writeHead(502, 'Proxy fetch failed');
    res.end();
  });

  req.pipe(rreq);
}

function handleSecure(req, socket) {
  logRequest(req);

  var dest = req.headers.host.split(':');
  var tunnel = net.createConnection(dest[1] || 443, dest[0], function() {
    socket.lock(function() {
      var socket = this;

      this.framer.replyFrame(
        this.id, 200, "Connection established", {"Connection": "keep-alive"},
        function (err, frame) {
          socket.connection.write(frame);
          socket.unlock();

          tunnel.pipe(socket);
          socket.pipe(tunnel);
        }
      );
    });
  });

  tunnel.setNoDelay(true);

  tunnel.on('error', function(e) {
    console.log("Tunnel error: " + e);
    socket.lock(function() {
      this.framer.replyFrame(
        this.id, 502, "Tunnel Error", {},
        function (err, frame) {
          socket.connection.write(frame);
          socket.unlock();
          socket.end();
        }
      );
    });
  });
}

var serverOptions = {
  key: fs.readFileSync(__dirname + '/keys/mykey.pem'),
  cert: fs.readFileSync(__dirname + '/keys/mycert.pem'),
  ca: fs.readFileSync(__dirname + '/keys/mycsr.pem')
};

var server = spdy.createServer(serverOptions);

server.on("request", handlePlain);
server.on("connect", handleSecure);

server.listen(44300);