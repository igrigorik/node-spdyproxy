function CmdPwdHelper(correct_user, correct_pass) {
  this.friendly_name = "cmdline password authenticator";
  this._correct_user = correct_user;
  this._correct_pass = correct_pass;
}

CmdPwdHelper.prototype.authUser = function(username, password, callback) {
  callback(this._correct_user == username && this._correct_pass == password);
};

module.exports = CmdPwdHelper;
