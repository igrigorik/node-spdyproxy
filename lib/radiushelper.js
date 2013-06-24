var util = require('util'),
    cache = require('memory-cache'),
    radius = require('radius'),
    dgram = require('dgram'),
    EventEmitter = require('events').EventEmitter;

function RADIUSHelper(server, port, secret, nasid, cred_ttl, verbose) {
  this.friendly_name = "RADIUS remote authenticator";
  this._verbose = verbose;

  this._server = server;
  this._port = port;
  this._secret = secret;
  this._nasid = nasid;
  this._creds_ttl = cred_ttl;

  this._authPacketId = 0;
  this._authCallbacks = {};
  this._authReadyNotify = new EventEmitter();
  this._authReadyNotify.setMaxListeners(100);
}

RADIUSHelper.prototype.authUser = function(username, password, callback) {
  self = this;

  if (username.length == 0 || password.length == 0){
    this._authReadyNotify.emit(username, true);
    callback(false);
    return;
  }

  if (cached_user = cache.get(username)) { // cache available
    if (this._verbose) console.log(cached_user);
    if (cached_user.state == 'fetching') { // cache incomplete, wait
      if (this._verbose) console.log("# incomplete cache, waiting...".grey);
      this._authReadyNotify.on(username, function(unexpectedResult) {
        if (unexpectedResult) {
          callback(false);
          return;
        }

        if (cached_user = cache.get(username)) {
          cached_user = cache.get(username);
          callback(cached_user['password'] == password);
        } else {
          callback(false);
        }
      })
    } else { // go ahead
      if (this._verbose) console.log("# user is cached".grey);
      callback(cached_user['password'] == password);
    }
  } else { // nothing is cached, request now
    if (this._verbose) console.log("# RADIUS user is NOT cached, requesting now:".grey);

    cache.put(username,
              {'state': 'fetching'},
              this._creds_ttl*60*1000);

    this._authCallbacks[this._authPacketId] = callback;

    var radiusPacket = {
      code: "Access-Request",
      secret: this._secret,
      identifier: this._authPacketId++,
      attributes: [
        ['NAS-Identifier', this._nasid],
        ['User-Name', username],
        ['User-Password', password]
      ]
    };

    var udpClient = dgram.createSocket("udp4");
    udpClient.bind();

    udpClient.on('message', function(msg, rinfo) {
      udpClient.close();
      var response = radius.decode({packet: msg, secret: self._secret});

      if (this._verbose) console.log(response.code);
      if (response.code == 'Access-Reject') {
        cached_maybe_incomplete_user = cache.get(username);
        if (cached_maybe_incomplete_user && cached_maybe_incomplete_user.state != 'current')
          cache.del(username);

        self._authCallbacks[response.identifier](false);
        return;
      }

      cache.put(username,
                {'password': password, 'state': 'current'},
                self._creds_ttl*60*1000);
      self._authReadyNotify.emit(username, false);

      self._authCallbacks[response.identifier](true);
    });

    try {
      if (this._verbose) console.log(radiusPacket);
      var encoded = radius.encode(radiusPacket);
      udpClient.send(encoded, 0, encoded.length, this._port, this._server);
    } catch(error) {
      this._authReadyNotify.emit(username, true);
      callback(false);
    }
  }
};

RADIUSHelper.prototype.acctAdd = function(packet_length) {
  // TODO
}

module.exports = RADIUSHelper;
