var spdy = require('spdy'),
    http = require('http'),
    path = require('path'),
    util = require('util'),
    net = require('net'),
    url = require('url'),
    fs = require('fs');

var SPDYProxy = function(options) {
  var self = this;

  this.setAuthHandler = function(handler) {
    self._authHandler = handler;
    console.log('AuthHandler'.green, handler.friendly_name.yellow,
                'will be used.'.green);
  }

  this.setLogHandler = function(handler) {
    self._logHandler = handler;
    console.log('Requests will be logged into file'.green, handler._filename.yellow);
  }

  function logRequest(req) {
    console.log(req.method.green + ' ' + req.url.yellow);
    for (var i in req.headers)
      console.log(' > '.grey + i.cyan + ': ' + req.headers[i]);
    console.log();
  }

  function synReply(socket, code, reason, headers, cb) {
    try {
      // SPDY socket
      if(socket._lock){
        socket._lock(function() {
          var socket = this;
          this._framer.replyFrame(
            this.id, code, reason, headers,
            function (err, frame) {
              socket.connection.write(frame);
              socket._unlock();
              cb.call();
            }
          );
        });

      // Chrome used raw SSL instead of SPDY when issuing CONNECT for
      // WebSockets. Hence, to support WS we must fallback to regular
      // HTTPS tunelling: https://github.com/igrigorik/node-spdyproxy/issues/26
      } else {
        var statusLine = 'HTTP/1.1 ' + code + ' ' + reason + '\r\n';
        var headerLines = '';
        for(key in headers){
            headerLines += key + ': ' + headers[key] + '\r\n';
        }
        socket.write(statusLine + headerLines + '\r\n', 'UTF-8', cb);
      }
    } catch(error) {
      cb.call();
    }
  }

  function handlePlain(req, res) {
    var path = req.headers.path || url.parse(req.url).path;
    var requestOptions = {
      host: req.headers.host.split(':')[0],
      port: req.headers.host.split(':')[1] || 80,
      path: path,
      method: req.method,
      headers: req.headers
    };

    var rreq = http.request(requestOptions, function(rres) {
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
    res.on('close', function() {
      rreq.abort();
    });
  }

  function handleSecure(req, socket) {
    var dest = req.url.split(':');
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
    var socket = (req.method == 'CONNECT') ? res : res.socket;
    console.log("%s:%s".yellow + " - %s - " + "stream ID: " + "%s".yellow + " - priority: " + "%s".yellow,
      socket.connection ? socket.connection.socket.remoteAddress : socket.socket.remoteAddress,
      socket.connection ? socket.connection.socket.remotePort : socket.socket.remotePort,
      req.method, res.streamID || socket.streamID,
      res.priority || socket.priority
    );

    // node-spdy forces chunked-encoding processing on inbound
    // requests without a content-length. However, we don't want
    // want to pass this injected header through to the destination.
    delete req.headers['transfer-encoding'];

    var dispatcher = function(req, res) {
      req.method == 'CONNECT' ? handleSecure(req, res) : handlePlain(req, res);
    }

    if (options.verbose) logRequest(req);

    if(typeof self._logHandler == 'object') {
      self._logHandler.log(socket, req);
    }

    if(typeof self._authHandler == 'object') { // an AuthHandler is defined
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

      self._authHandler.authUser(username, password, function(authPassed) {
        if (authPassed)
          return dispatcher(req, res);

        synReply(socket, 407, 'Proxy Authentication Required',
          {'proxy-authenticate': 'Basic realm="SPDY Proxy"'},
          function() {
            socket.end();
          }
        );
      });
    } else { // auth is not necessary, simply go ahead and dispatch to funcs
      dispatcher(req, res);
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
