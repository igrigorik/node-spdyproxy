var util = require('util'),
    cache = require('memory-cache'),
    radius = require('radius'),
    dgram = require('dgram');

function RADIUSHelper(server, port, secret, nasid, cred_ttl) {
  this.friendly_name = "RADIUS remote authenticator";
  this._server = server;
  this._port = port;
  this._secret = secret;
  this._nasid = nasid;
  this._creds_ttl = cred_ttl;
  // this._readyNotify = require('events').EventEmitter;
}

RADIUSHelper.prototype.authUser = function(username, password) {
  self = this;

  if (cached_user = cache.get(username)) { // cache available
    console.log(" - user is cached");
    callback(cached_user['password'] == password);
  } else { // nothing is cached, request now
    console.log(" - user is NOT cached, requesting now");

    var radiusPacket = {
      code: "Access-Request",
      secret: this._secret,
      identifier: 0, // we do not need this b/c async is not implemented yet
      attributes: [
        ['NAS-Identifier', this._nasid],
        ['User-Name', username],
        ['User-Password', password]
      ]
    };

    // TODO: rewrite to accept other requests while waiting for RADIUS server
    // 
    // One might implement this by saving a 'state' attribute, like this:
    //   cache.put(username,
    //             {'state': 'fetching'},
    //             this._creds_ttl*60);
    
    var udpClient = dgram.createSocket("udp4");
    udpClient.bind();

    client.on('message', function (msg, rinfo) {
      client.close();
      var response = radius.decode({packet: msg, secret: this._secret});

      if (resp.code == 'Access-Reject') {
        callback(false);
        return;
      }

      cache.put(username,
          {'password': password/*, 'state': 'current'*/},
          this._creds_ttl*60);

      callback(true);
    });

    var encoded = radius.encode(radiusPacket);
    client.send(encoded, 0, encoded.length, this._port, this._server);
  }
};

RADIUSHelper.prototype.acctAdd = function(packet_length) {
  // TODO
}

module.exports = RADIUSHelper;
