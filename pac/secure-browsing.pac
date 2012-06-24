//
// Route *all* requests through local SPDY proxy
//

function FindProxyForURL(url, host) {
  // - no fallback mechanism
  // - if proxy supports SPDY then SPDY tunnel will be negotiated
  return "HTTPS localhost:44300";

  // if proxy fails, connect directly
  //return "HTTPS localhost:44300; DIRECT";
}
