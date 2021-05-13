Components.utils.import('resource://pang/db.jsm');
var Pang =
{
 medium: 300,
 high: 600,
 timeout: 6000,
 interval: 30000,
 tmr: null,
 ttTime: null,
 ttTimeout: null,
 init: function()
 {
  let loc = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle('chrome://pang/locale/pang.properties');
  Pang.ttTimeout = loc.GetStringFromName('ping.timeout');
  Pang.ttTime = loc.GetStringFromName('ping.time');
  Pang_DB.cache = new Map();
  Pang_DB.dns = new Map();
  let progressListener =
  {
   onLocationChange : Pang.waitOnLocationChange,
   onProgressChange : function() {},
   onSecurityChange : function() {},
   onStateChange : function() {},
   onStatusChange : function() {}
  };
  window.getBrowser().addProgressListener(progressListener);
 },
 resolve: async function(uri)
 {
  return new Promise((resolve, reject) => {
   let cbProxy =
   {
    onProxyAvailable: function(_request, _uri, proxyinfo, status)
    {
     if (status === Components.results.NS_ERROR_ABORT)
     {
      resolve('FAIL');
      return;
     }
     if ((proxyinfo !== null) && (proxyinfo.flags & proxyinfo.TRANSPARENT_PROXY_RESOLVES_HOST))
     {
      resolve('FAIL');
      return;
     }
     let curThread = Components.classes['@mozilla.org/thread-manager;1'].getService(Components.interfaces.nsIThreadManager).currentThread;
     let dResolved = Components.classes['@mozilla.org/network/dns-service;1'].getService(Components.interfaces.nsIDNSService).asyncResolve(uri.host, 0, cbLookup, curThread);
    }
   };
   let cbLookup =
   {
    onLookupComplete : function(_request, dnsrecord, status)
    {
     if (status === Components.results.NS_ERROR_ABORT)
     {
      resolve('FAIL');
      return;
     }
     if (status !== 0 || !dnsrecord || !dnsrecord.hasMore())
     {
      resolve('FAIL');
      return;
     }
     resolve(dnsrecord.getNextAddrAsString());
    }
   };
   let pResolved = Components.classes['@mozilla.org/network/protocol-proxy-service;1'].getService(Components.interfaces.nsIProtocolProxyService).asyncResolve(uri, 0, cbProxy);
  });
 },
 getPath: async function(wnd)
 {
  let currentURI = wnd.getBrowser().selectedBrowser.currentURI;
  if (currentURI.spec.startsWith('about:reader?url='))
   return null;
  if (currentURI.scheme === 'view-source')
   return null;
  if (currentURI.scheme === 'jar')
   return null;
  if (currentURI.scheme === 'chrome')
   return null;
  if (currentURI.scheme === 'about')
   return null;
  let res = Pang_DB.dns.get(currentURI.host);
  if (res)
   return 'http://' + res + '/.well-known/time';
  try
  {
   let ip = await Pang.resolve(currentURI);
   if (ip !== 'FAIL')
   {
    Pang_DB.dns.set(currentURI.host, ip);
    return 'http://' + ip + '/.well-known/time';
   }
  }
  catch (ex) {}
  return currentURI.prePath + '/.well-known/time';
 },
 waitOnLocationChange: async function()
 {
  if (document.getElementById('pang-tb') === null)
   return;
  if (Pang_DB.busy === true)
  { 
   window.setTimeout(Pang.waitOnLocationChange, 150);
   return;
  }
  Pang_DB.busy = true;
  let delay = 300;
  let sPath = await Pang.getPath(window);
  if (sPath === null)
  {
   Pang.showNull();
   Pang_DB.busy = false;
   return;
  }
  let cached = Pang_DB.cache.get(sPath);
  if (cached)
  {
   let stored = cached[0];
   if (stored === -1)
    Pang.showTimeout();
   else
    Pang.showResult(stored);
  }
  let prefs = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch);
  if (prefs.prefHasUserValue('extensions.pang.delay'))
   delay = prefs.getIntPref('extensions.pang.delay');
  Pang_DB.busy = false;
  if (delay === 0)
  {
   await Pang.onLocationChange();
   return;
  }
  if (Pang.tmr !== null)
  {
   window.clearTimeout(Pang.tmr);
   Pang.tmr = null;
  }
  Pang.tmr = window.setTimeout(Pang.onLocationChange, delay);
 },
 onLocationChange: async function()
 {
  if (document.getElementById('pang-tb') === null)
   return;
  if (Pang_DB.busy === true)
  {
   window.setTimeout(Pang.onLocationChange, 150);
   return;
  }
  Pang_DB.busy = true;
  let prefs = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch);
  if (prefs.prefHasUserValue('extensions.pang.increment'))
   Pang.interval = (prefs.getIntPref('extensions.pang.increment') * 1000);
  else
   Pang.interval = 30000;
  if (prefs.prefHasUserValue('extensions.pang.timeout'))
   Pang.timeout = (prefs.getIntPref('extensions.pang.timeout') * 1000);
  else
   Pang.timeout = 6000;
  if (prefs.prefHasUserValue('extensions.pang.high'))
   Pang.high = prefs.getIntPref('extensions.pang.high');
  else
   Pang.high = 600;
  if (prefs.prefHasUserValue('extensions.pang.medium'))
   Pang.medium = prefs.getIntPref('extensions.pang.medium');
  else
   Pang.medium = 300;
  if (Pang.tmr !== null)
  {
   window.clearTimeout(Pang.tmr);
   Pang.tmr = null;
  }
  let sPath = await Pang.getPath(window);
  if (sPath === null)
  {
   Pang.showNull();
   Pang_DB.busy = false;
   return;
  }
  let cached = Pang_DB.cache.get(sPath);
  var start = new Date().getTime();
  if (cached)
  {
   let stored = cached[0];
   if (stored === -1)
    Pang.showTimeout();
   else
    Pang.showResult(stored);
   let updated = cached[1];
   if (updated < start)
   {
    let diff = Pang.interval;
    if (diff > 0)
    {
     if ((start - updated) < diff)
     {
      diff -= (start - updated);
      Pang.tmr = window.setTimeout(Pang.onLocationChange, diff);
      Pang_DB.busy = false;
      return;
     }
    }
   }
   if (Pang.interval === 0)
   {
    Pang_DB.busy = false;
    return;
   }
  }
  else
   Pang.showNull();
  try
  {
   let timeout = Pang.timeout;
   let ab = new AbortController
   let abid = setTimeout(() => ab.abort(), timeout);
   let ret = await fetch(sPath, {method: 'HEAD', cache: 'no-cache', redirect: 'manual', signal: ab.signal});
   clearTimeout(abid);
   let end = new Date().getTime();
   Pang_DB.cache.delete(sPath);
   Pang_DB.cache.set(sPath, [(end - start), end]);
   Pang.showResult(end - start);
   Pang_DB.busy = false;
   if (Pang.interval > 0)
    Pang.tmr = window.setTimeout(Pang.onLocationChange, Pang.interval);
  }
  catch (ex)
  {
   let end = new Date().getTime();
   Pang_DB.cache.delete(sPath);
   Pang_DB.cache.set(sPath, [-1, end]);
   Pang.showTimeout();
   Pang_DB.busy = false;
   if (Pang.interval > 0)
    Pang.tmr = window.setTimeout(Pang.onLocationChange, Pang.interval);
  }
 },
 showNull: function()
 {
  if (document.getElementById('pang-tb') === null)
   return;
  document.getElementById('pang-tb').className = 'null';
  if (document.getElementById('pang-tb').hasAttribute('tooltiptext'))
   document.getElementById('pang-tb').removeAttribute('tooltiptext');
 },
 showResult: function(t)
 {
  if (document.getElementById('pang-tb') === null)
   return;
  let color = 'green';
  if (t > Pang.high)
   color = 'red';
  else if (t > Pang.medium)
   color = 'yellow';   
  document.getElementById('pang-tb').className = color;
  let ttTime = Pang.ttTime.replace('%1', t);
  document.getElementById('pang-tb').setAttribute('tooltiptext', ttTime);
 },
 showTimeout: function()
 {
  if (document.getElementById('pang-tb') === null)
   return;
  document.getElementById('pang-tb').className = 'timeout';
  document.getElementById('pang-tb').setAttribute('tooltiptext', Pang.ttTimeout);
 }
};
window.addEventListener('load', Pang.init, false);
