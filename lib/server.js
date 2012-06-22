var spdy = require('spdy'),
    http = require('http'),
    path = require('path'),
    util = require('util'),
    net = require('net'),
    fs = require('fs');

var SPDYProxy = function(options) {
  function logRequest(req) {
    console.log(req.method.green + ' ' + req.url.yellow);
    for (var i in req.headers)
      console.log(' > '.grey + i.cyan + ': ' + req.headers[i]);
    console.log();
  }

  function synReply(socket, code, reason, headers, cb) {
    socket.lock(function() {
      var socket = this;

      this.framer.replyFrame(
        this.id, code, reason, headers,
        function (err, frame) {
          socket.connection.write(frame);
          socket.unlock();
          cb.call();
        }
      );
    });
  }

  function handlePlain(req, res) {
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
    var dest = req.headers.host.split(':');
    var tunnel = net.createConnection(dest[1] || 443, dest[0], function() {
      synReply(socket, 200, 'Connection established', {'Connection': 'keep-alive'}, function() {
        tunnel.pipe(socket);
        socket.pipe(tunnel);
      });
    });

    tunnel.setNoDelay(true);

    tunnel.on('error', function(e) {
      console.log("Tunnel error: ".red + e);
      synReply(socket, 502, "Tunnel Error", {}, function() {
        socket.end();
      });
    });
  }

  function handleRequest(req, res) {
    if (options.verbose) logRequest(req);

    var socket = (req.method == 'CONNECT') ? res : res.socket;
    console.log("%s:%s".yellow + " - %s - " + "stream ID: " + "%s".yellow,
      socket.connection.socket.remoteAddress,
      socket.connection.socket.remotePort,
      req.method, res.streamID || socket.streamID
    );

    if (options.user) {
      // perform basic proxy auth (over established SSL tunnel)
      // - http://www.chromium.org/spdy/spdy-authentication
      var header = req.headers['proxy-authorization'] || '',
          token = header.split(/\s+/).pop() || '',
          auth = new Buffer(token, 'base64').toString(),
          parts = auth.split(/:/),
          username = parts[0],
          password = parts[1];

      // don't pass proxy-auth headers upstream
      delete req.headers['proxy-authorization'];

      if((username != options.user) || (password != options.pass)) {
        synReply(socket, 407, 'Proxy Authentication Required',
          {'Proxy-Authenticate': 'Basic realm="SPDY Proxy"'},
          function() {
            socket.end();
          }
        );

        return;
      }
    }

    if (req.method == 'CONNECT') {
      handleSecure(req, res);
    }  else {
      handlePlain(req, res);
    }
  }

  spdy.server.Server.call(this, options);

  this.on("connect", handleRequest);
  this.on("request", handleRequest);
};

util.inherits(SPDYProxy, spdy.server.Server);

var createServer = function(options) {
  return new SPDYProxy(options);
};

exports.SPDYProxy = SPDYProxy;
exports.createServer = createServer;
