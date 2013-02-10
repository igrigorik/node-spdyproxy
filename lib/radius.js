var radius = require('radius')
  , dgram  = require('dgram');

var pool     = []
  , sessions = {}
  , cache    = {}
  , config   = {
		threads: 10
  };

var createRADIUSConnection = function(next) {
	var client = dgram.createSocket("udp4");

	client.bind();
	client.busy = false;

	client.on('message', function (msg, rinfo) {
		var resp = radius.decode({packet: msg, secret: config.secret});

		if(typeof resp !== 'object')
			return console.log('Unable to parse packet from '.red + ('#' + i).grey);

		if(!sessions[resp.identifier])
			return console.log('Unable to find identifier'.red + String(resp.identifier).grey + 'from '.red + ('#' + i).grey);

		if(resp.code == 'Access-Reject') {
			console.log('Unable to authorize user '.red + sessions[resp.identifier].username.grey);

			sessions[resp.identifier].callback(false);
		} else {
			cache[sessions[resp.identifier].username] = {
				password: sessions[resp.identifier].password,
				time: Date.now()
			};

			console.log('Authorized user '.green + sessions[resp.identifier].username.grey);

			sessions[resp.identifier].callback(true);
		}

		client.busy = false;
		delete sessions[resp.identifier];
	});

	pool.push(client);

	var i = pool.length;

	console.log(
		'Created RADIUS Connection'.green +
		(' #' + i + ' ').white +
		'listening port '.green +
		String(client.address().port).white
	);

	if(typeof next == 'function')
		next(null, client);
} , verifyCredential = function(username, password, next) {
	if(!username || !password)
		return next(false);

	if(cache[username] && cache[username].password == password) {
		if((Date.now() - cache[username].time) / 1000 > config.ttl) {
			delete cache[username];
		} else {
			return next(true);
		}
	}

	var packet = {
		code: "Access-Request",
		secret: config.secret,
		identifier: Number(String(Math.random()).split('.')[1].substr(0,2)),
		attributes: [
			['NAS-Identifier', config.nasid],
			['User-Name', username],
			['User-Password', password]
		]
	};

	sessions[packet.identifier] = {
		username: username,
		password: password,
		callback: next
	};

	sendAuthPacket(packet);
} , sendAuthPacket = function(packet) {
	for (var i = 0; i < pool.length; i++) {
		if(!pool[i].busy) {
			console.log('Sending RADIUS packet via '.green + ('#' + (pool.length + 1)).grey);

			var encoded = radius.encode(packet);

			pool[i].busy = true;

			return pool[i].send(encoded, 0, encoded.length, config.port, config.host);
		}
	}

	console.log('No available connection, waiting for one second ...'.yellow);

	setTimeout(function() {
		sendAuthPacket(packet)
	}, 1000);
}

module.exports = function (opts) {
	config.host   = opts['radius-server'];
	config.port   = opts['radius-port'];
	config.secret = opts['radius-secret'];
	config.nasid  = opts['radius-nasid'];
	config.ttl    = Number(opts['radius-creds-ttl']);

	for (var i = 0; i < config.threads; i++)
		createRADIUSConnection();

	return verifyCredential;
}