var Pang =
{
 cache: null,
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
  Pang.cache = new Map();
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
 getPath: function(wnd)
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
  return currentURI.prePath + '/.well-known/time';
 },
 waitOnLocationChange: function()
 {
  if (document.getElementById('pang-tb') === null)
   return;
  let delay = 300;
  let sPath = Pang.getPath(window);
  if (sPath === null)
  {
   Pang.showNull();
   return;
  }
  let cached = Pang.cache.get(sPath);
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
  if (delay === 0)
  {
   Pang.onLocationChange();
   return;
  }
  if (Pang.tmr !== null)
  {
   window.clearTimeout(Pang.tmr);
   Pang.tmr = null;
  }
  Pang.tmr = window.setTimeout(Pang.onLocationChange, delay);
 },
 onLocationChange: function()
 {
  if (document.getElementById('pang-tb') === null)
   return;
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
  let sPath = Pang.getPath(window);
  if (sPath === null)
  {
   Pang.showNull();
   return;
  }
  let cached = Pang.cache.get(sPath);
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
      return;
     }
    }
   }
   if (Pang.interval === 0)
    return;
  }
  else
   Pang.showNull();
  let ping = new XMLHttpRequest();
  
  ping.onreadystatechange = function()
  {
   if (ping.readyState !== 4)
    return;
   let end = new Date().getTime();
   Pang.cache.delete(sPath);
   Pang.cache.set(sPath, [(end - start), end]);
   Pang.showResult(end - start);
   if (Pang.interval > 0)
    Pang.tmr = window.setTimeout(Pang.onLocationChange, Pang.interval);
  };
  ping.ontimeout = function()
  {
   let end = new Date().getTime();
   Pang.cache.delete(sPath);
   Pang.cache.set(sPath, [-1, end]);
   Pang.showTimeout();
   if (Pang.interval > 0)
    Pang.tmr = window.setTimeout(Pang.onLocationChange, Pang.interval);
  };
  ping.onerror = function()
  {
   let end = new Date().getTime();
   Pang.cache.delete(sPath);
   Pang.cache.set(sPath, [-1, end]);
   Pang.showTimeout();
   if (Pang.interval > 0)
    Pang.tmr = window.setTimeout(Pang.onLocationChange, Pang.interval);
  };
  ping.timeout = Pang.timeout;
  ping.open('GET', sPath, true);
  ping.send();
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
