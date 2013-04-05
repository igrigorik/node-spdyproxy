var fs = require('fs');

function LoggingHelper(filename) {
	this._filename = filename;
	time = dateFormat(new Date (), "%Y-%m-%d %H:%M:%S", false);
	fs.appendFile(filename, time + ' node-spdyproxy is now running\n', function (err) {
		if (err) {
			throw err;
			process.exit();
		}
	});
}

function dateFormat (date, fstr, utc) {
  utc = utc ? 'getUTC' : 'get';
  return fstr.replace (/%[YmdHMS]/g, function (m) {
    switch (m) {
    case '%Y': return date[utc + 'FullYear'] (); // no leading zeros required
    case '%m': m = 1 + date[utc + 'Month'] (); break;
    case '%d': m = date[utc + 'Date'] (); break;
    case '%H': m = date[utc + 'Hours'] (); break;
    case '%M': m = date[utc + 'Minutes'] (); break;
    case '%S': m = date[utc + 'Seconds'] (); break;
    default: return m.slice (1); // unknown code, remove %
    }
    // add leading zero if required
    return ('0' + m).slice (-2);
  });
}
/* dateFormat (new Date (), "%Y-%m-%d %H:%M:%S", true) returns 
   "2012-05-18 05:37:21"  */

LoggingHelper.prototype.log = function(socket, req) {
	var addr = socket.connection ? socket.connection.socket.remoteAddress : socket.socket.remoteAddress;
	time = dateFormat(new Date (), "%Y-%m-%d %H:%M:%S", false);
	logstring = time + " " + addr + " " + req.method;
	logstring += (req.method == 'CONNECT')?(" \"" + req.url + "\""):(" \"" + req.headers['host'] + "\" \"" + req.url + "\"");
	logstring += "\n";

	fs.appendFile(this._filename, logstring, function (err) {
		if (err) {
			throw err;
		}
	});
}

module.exports = LoggingHelper;
