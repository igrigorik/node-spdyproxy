//
// Proxy different hosts through different proxies: HTTP, SOCKS, HTTPS
// Use direct connections for all other hosts
//

function FindProxyForURL(url, host){
  if (shExpMatch(host, "*.google.com*")) {
    return "HTTPS proxy.host1.com:443;"
  }
  else if (shExpMatch(host, "*.yahoo.com*")) {
    return "SOCKS proxy.host2.com:9000; DIRECT;"
  }
  else if (shExpMatch(host, "*.github.com*")) {
    return "HTTP proxy.host3.com:9000";
  }
  else {
    return "DIRECT";
  }
}
