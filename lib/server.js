var spdy = require('spdy'),
    http = require('http'),
    path = require('path'),
    util = require('util'),
    net = require('net'),
    url = require('url'),
    fs = require('fs');

var SPDYProxy = function(options) {
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
    var path = req.headers.path || url.parse(req.url).path;
    var requestOptions = {
      host: req.headers.host,
      port: req.headers.host.split(':')[1] || 80,
      path: path,
      method: req.method,
      headers: req.headers
    };

    var rreq = http.request(requestOptions, function(rres) {
      delete rres.headers['transfer-encoding'];
      rres.headers['proxy-agent'] = 'SPDY Proxy ' + options.version;

      // write out headers to handle redirects
      res.writeHead(rres.statusCode, '', rres.headers);
      rres.pipe(res);

      // Res could not write, but it could close connection
      res.pipe(rres);
    });

    rreq.on('error', function(e) {
      console.log("Client error: " + e.message);
      res.writeHead(502, 'Proxy fetch failed');
      res.end();
    });

    req.pipe(rreq);

    // Just in case if socket will be shutdown before http.request will connect
    // to the server.
    res.pipe(rreq);
  }

  function handleSecure(req, socket) {
    var dest = req.headers.host.split(':');
    var tunnel = net.createConnection(dest[1] || 443, dest[0], function() {
      synReply(socket, 200, 'Connection established',
        {
          'Connection': 'keep-alive',
          'Proxy-Agent': 'SPDY Proxy ' + options.version
        },
        function() {
          tunnel.pipe(socket);
          socket.pipe(tunnel);
        }
      );
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
    var timestamp = new Date().toISOString();
    var https = req.method == 'CONNECT';
    var socket = https ? res : res.socket;

    if (!options.auth) return acceptRequest();

    // perform basic proxy auth (over established SSL tunnel)
    // - http://www.chromium.org/spdy/spdy-authentication
    var header = req.headers['proxy-authorization'];
    if (!header) return rejectRequest({reason: 'Proxy Authentication Required'});
    var tokens = header.match(/^(\S+)\s+(\S+)\s*$/);
    if (!tokens) return rejectRequest({reason: 'Proxy Authentication Header Malformed'});
    if (tokens[1].toLowerCase() != 'basic') return rejectRequest({reason: 'Proxy Authentication Scheme Not Supported'});

    options.auth.verify(tokens[2], timestamp, acceptRequest, rejectRequest);

    function acceptRequest(user) {
      logRequest(user);
      // don't pass proxy-auth headers upstream
      delete req.headers['proxy-authorization'];

      if (https) {
        handleSecure(req, res);
      } else {
        handlePlain(req, res);
      }
    }

    function rejectRequest(err) {
      err.err = err.err || err.reason;
      err.reason = err.reason || 'Proxy Authentication Failed';
      logRequest(err);

      synReply(socket, 407, err.reason,
        {'Proxy-Authenticate': 'Basic realm="SPDY Proxy"'},
        function() {
          socket.end();
        }
      );
    }

    function logRequest(data) {
      console.log('%s %s %s%s%s %s %s%s%s',
        timestamp,
        ('#' + res.streamID).grey,
        data.username ? data.username.magenta + '@' : '',
        socket.connection.socket.remoteAddress.yellow,
        (':' + socket.connection.socket.remotePort).yellow,
        req.method.green,
        req.headers.host.yellow,
        https ? '' : req.headers.path.yellow,
        data.err ? ' ' + ('407 ' + data.err).red : ''
      );

      if (!options.verbose) return;
      for (var i in req.headers)
        console.log('%s %s: %s', '>'.grey, i.cyan, req.headers[i]);
      console.log();
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
