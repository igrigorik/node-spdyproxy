// Example from: https://calomel.org/proxy_auto_config.html
//

// Default connection
var direct = "DIRECT";

// Alternate Proxy Server
var proxy = "PROXY 192.168.1.100:8080";

// Default localhost for denied connections
var deny = "PROXY 127.0.0.1:65535";

//
// Proxy Logic
//

function FindProxyForURL(url, host) {

  // Anti-ads and Anti-porn
  if (dnsDomainIs(host, ".burstnet.com")
    || dnsDomainIs(host, ".adbureau.net")
    || dnsDomainIs(host, ".targetnet.com")
    || dnsDomainIs(host, ".humanclick.com")
    || dnsDomainIs(host, ".linkexchange.com")
    || dnsDomainIs(host, ".fastclick.com")
    || dnsDomainIs(host, ".fastclick.net")
    || dnsDomainIs(host, ".admonitor.com")
    || dnsDomainIs(host, ".focalink.com")
    || dnsDomainIs(host, ".websponsors.com")
    || dnsDomainIs(host, ".advertising.com")
    || dnsDomainIs(host, ".cybereps.com")
    || dnsDomainIs(host, ".postmasterdirect.com")
    || dnsDomainIs(host, ".mediaplex.com"))
    // ....

    { return deny; }
   else
    { return direct; }
}
