var crypto = require('crypto');

function AuthDBHelper(authdata) {
  this.friendly_name = 'PBKDF2 password database authenticator';
  this.init(authdata);
};

var ITERNUM = AuthDBHelper.ITERNUM = 1000;
var SALTLEN = AuthDBHelper.SALTLEN = 8;
var KEYLEN = SALTLEN;

AuthDBHelper.calc = function(password, salt, hash, onFinish) {
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

AuthDBHelper.prototype.init = function(authdata) {
  authdata = authdata && authdata.toString().split(/[\r\n]+/);
  this._users = {};
  this._auths = {};

  for (var i in authdata) {
    var line = authdata[i];
    if (!line || line[0] == ':') continue;
    var user = line.match(/^([^:]+)\:((?:[0-9a-fA-F]{2})+)\.((?:[0-9a-fA-F]{2})+)\s*$/);
    if (!user) throw new SyntaxError(line);
    this._users[user[1]] = [user[2], user[3]];
  };
};

AuthDBHelper.prototype.authUser = function(username, password, callback) {
  var rec = new Date().toISOString();
  var users = this._users, auths = this._auths;
  var cred = username + ':' + password;
  if (cred in auths) return confirm();
  var user = users[username];
  if (!user) return deny();
  this.constructor.calc(password, user[0], user[1], onCalc);

  function onCalc(err, match) {
    if (!err && match === true) {
      return confirm();
    } else {
      return deny();
    };
  };

  function confirm() {
    auths[cred] = rec;
    callback(true);
  };

  function deny() {
    callback(false);
  }
};

module.exports = AuthDBHelper;
