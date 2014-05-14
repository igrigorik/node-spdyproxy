var spdy = require('spdy');
var http = require('http');
var assert = require('assert');

describe('SPDY Proxy', function() {
  var spdyAgent;

  before(function(done) {
    var i = 2;
    process.argv[i++] = '--key';
    process.argv[i++] = __dirname + '/../keys/mykey.pem';
    process.argv[i++] = '--cert';
    process.argv[i++] = __dirname + '/../keys/mycert.pem';
    require('../bin/spdyproxy');

    spdyAgent = spdy.createAgent({
      host: '127.0.0.1',
      port: 44300,
      rejectUnauthorized: false
    });

    done();
  });

  it('should be able to fetch www.google.com over spdy via GET', function(done) {
    var options = {
      method: 'GET',
      host: 'www.google.com',
      agent: spdyAgent
    };

    var req = http.request(options, function(res) {
      var googlePage = "";
      assert.equal(res.statusCode, 200);

      res.on('data', function(chunk) {
        googlePage += chunk.toString();
      });

      res.on('end', function() {
        assert.notEqual(googlePage.search('google'), -1, 
          "Google page should contain string 'google'");
        done();
      });
    });
    req.end();
  });

  it('should be able to fetch www.google.com over spdy via CONNECT', function(done) {
    var options = {
      method: 'CONNECT',
      path: 'www.google.com:80',
      agent: spdyAgent
    };

    var req = http.request(options);
    req.end();

    req.on('connect', function(res, socket) {
      var googlePage = "";
      socket.write('GET / HTTP/1.1\r\n' +
                   'Host: www.google.com:80\r\n' +
                   'Connection: close\r\n' +
                   '\r\n');

      socket.on('data', function(chunk) {
        googlePage = googlePage + chunk.toString();
      });

      socket.on('end', function() {
        assert.notEqual(googlePage.search('google'), -1, 
          "Google page should contain string 'google'");
        done();
      });
    });
  });

  after(function(done) {
    spdyAgent.close(function() {
      done();
    });
  });
});
