assertNodeVersion('0.8.7', 'Node.js v0.8.7 or higher required\n\nPrior versions contain a deadly bug in the standard crypto library effecting functions essential to password hashing:\nhttps://github.com/joyent/node/issues/3866');
var crypto = require('crypto');

function assertNodeVersion(ver, msg) {
  var cur = process.versions.node.split('.'), min = ver.split('.'), c, m;
  for (var i in min) {
    c = parseInt(cur[i]) || 0, m = parseInt(min[i]) || 0;
    if (c < m) break;
    if (c > m) return;
  };
  if (c == m) return;
  console.error(msg);
  process.exit(1);
};

var ITERNUM = exports.ITERNUM = 1000;
var SALTLEN = exports.SALTLEN = 8;
var KEYLEN = SALTLEN;

var calc = function(password, salt, hash, onFinish) {
  if (onFinish === undefined) {
    if (hash === undefined) {
      onFinish = salt;
      salt = undefined;
    } else {
      onFinish = hash;
    };
    hash = undefined;
  };

  try {
    salt = (salt === undefined) ? crypto.randomBytes(SALTLEN) : new Buffer(salt, 'hex');
    crypto.pbkdf2(password, salt, ITERNUM, KEYLEN, onKey);
  } catch (exc) {
    onFinish(exc);
  };

  function onKey(err, key) {
    try {
      if (err) throw err;
      key = new Buffer(key, 'binary');
      onFinish(err, (hash !== undefined && hash.toString('hex') == key.toString('hex')) ? true : [salt, key]);
    } catch (exc) {
      onFinish('Error: ' + exc);
    };
  };
};

var users;
var auths;

var init = function(data) {
  data = data && data.toString().split(/[\r\n]+/);
  users = auths = {};

  for (var i in data) {
    var line = data[i];
    if (!line || line[0] == ':') continue;
    var user = line.match(/^([^:]+)\:((?:[0-9a-fA-F]{2})+)\.((?:[0-9a-fA-F]{2})+)\s*$/);
    if (!user) throw new SyntaxError(line);
    users[user[1]] = [user[2], user[3]];
  };

  this.verify = this.verify || verify;
  return this;
};

var verify = function(cred, rec, onConfirm, onDeny) {
  if (cred in auths) return confirm(auths[cred][0], true);
  var userpass = new Buffer(cred, 'base64').toString().match(/^([^:]*):(.*)$/);
  if (!userpass) return deny('Malformed credential for HTTP basic auth');
  var user = users[userpass[1]];
  if (!user) return deny('Unknown username');
  calc(userpass[2], user[0], user[1], onCalc);

  function onCalc(err, match) {
    if (err) return deny(err);
    (match === true) ? confirm(userpass[1], false) : deny('Incorrect password');
  };

  function confirm(username, cached) {
    auths[cred] = [username, rec];
    onConfirm({username: username, cached: cached});
  };

  function deny(err) {
    onDeny({err: err});
  }
};

exports.calc = calc;
exports.init = init;
