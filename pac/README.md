# Proxy Auto Configuration (PAC)

A proxy auto-config (PAC) file defines how web browsers and other user agents can automatically choose the appropriate proxy server (access method) for fetching a given URL. To create a valid PAC file you simply need to provide a single JavaScript function: `FindProxyForURL(url, host)`. This function is automatically executed by the browser when requests are dispatched.

The URL of the PAC file is either configured manually or determined automatically by the Web Proxy Auto-discovery Protocol.

- [Wikipedia: PAC](http://en.wikipedia.org/wiki/Proxy_auto-config)
- [Available JavaScript PAC functions](http://www.findproxyforurl.com/pac_functions_explained.html)

## Example PAC file

```javascript
function FindProxyForURL(url, host) {
  // our local URLs from the domains below example.com don't need a proxy:
  if (shExpMatch(host, "*.example.com")) {
     return "DIRECT";
  }

  // our local URLs from the domains below example.com don't need a proxy:
  if (shExpMatch(host, "*.google.com")) {
     return "HTTPS localhost:44300";
  }

  // URLs within this network are accessed through
  // port 8080 on fastproxy.example.com:
  if (isInNet(host, "10.0.0.0",  "255.255.248.0")) {
     return "PROXY fastproxy.example.com:8080";
  }

  // Use a different proxy for each protocol.
  if (shExpMatch(url, "http:*"))  return "PROXY proxy1.domain.com:3128";
  if (shExpMatch(url, "https:*")) return "PROXY proxy2.domain.com:3128";
  if (shExpMatch(url, "ftp:*"))   return "PROXY proxy3.domain.com:3128";

  // All other requests go through port 8080 of proxy.example.com.
  // should that fail to respond, go directly to the WWW:
  return "PROXY proxy.example.com:8080; DIRECT";
}
```

For more examples of what you can do with PAC files, use your favorite search engine, and also checkout the individual *.pac* files in this directory.

Now that you've created your custom PAC file, how do you deploy it? Turns out, all browsers support the proxy auto-discovery protocol (WPAD), which allows us to either (a) manually specify the file, or (b) auto-configure the settings through DNS or DHCP:

- [Web Proxy Auto-Discovery Protocol (WPAD)](http://en.wikipedia.org/wiki/Web_Proxy_Autodiscovery_Protocol)
- [Auto-configuring Proxy Settings with a PAC File](https://mikewest.org/2007/01/auto-configuring-proxy-settings-with-a-pac-file)
- [Automatic proxy HTTP server configuration in web browsers](http://homepage.ntlworld.com./jonathan.deboynepollard/FGA/web-browser-auto-proxy-configuration.html)
