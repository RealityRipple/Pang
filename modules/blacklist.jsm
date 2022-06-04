Components.utils.import('resource://gre/modules/Services.jsm');

var EXPORTED_SYMBOLS = ['Pang_Blacklist'];

var Pang_Blacklist = {
 registered: false,
 ui: function() {},
 uis: [],
 register: function()
 {
  if (Pang_Blacklist.registered)
   return;
  Pang_Blacklist.registered = true;
  Services.obs.addObserver(this, "addon-options-displayed", false);
  Services.obs.addObserver(this, "addon-options-hidden", false);
 },
 unregister: function()
 {
  if (!Pang_Blacklist.registered)
   return;
  let mdtr = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
  let brw = mdtr.getEnumerator('navigator:browser');
  let bCt = 0;
  while (brw.hasMoreElements())
  {
   let wnd = brw.getNext();
   if ('Pang' in wnd)
    bCt++;
  }
  if (bCt > 0)
   return;
  while (Pang_Blacklist.uis.length > 0)
  {
   let tUI = Pang_Blacklist.uis.shift();
   if (typeof tUI === 'undefined')
    break;
   tUI.destroy();
  }
  Pang_Blacklist.registered = false;
 },
 handleDisplayed: function(doc)
 {
  let bl = doc.getElementById('vbBlacklist');
  if (bl === null)
   return;
  let rndID = 0;
  let match = true;
  while (match)
  {
   rndID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
   let found = false;
   for (let i = 0; i < Pang_Blacklist.uis.length; i++)
   {
    let bl = Pang_Blacklist.uis[i].doc.getElementById('vbBlacklist');
    if (bl === null)
     continue;
    let id = bl.getAttribute('data-id');
    if (rndID === id)
    {
     found = true;
     break;
    }
   }
   if (!found)
    match = false;
  }
  bl.setAttribute('data-id', rndID);
  let ui = new Pang_Blacklist.ui();
  ui.construct(doc);
  Pang_Blacklist.uis.push(ui);
 },
 handleHidden: function(doc)
 {
  let findID = false;
  if (doc.getElementById('vbBlacklist') !== null)
   findID = doc.getElementById('vbBlacklist').getAttribute('data-id');
  if (findID === false)
   return;
  for (let i = 0; i < Pang_Blacklist.uis.length; i++)
  {
   let tUI = Pang_Blacklist.uis[i];
   let bl = tUI.doc.getElementById('vbBlacklist');
   if (bl === null)
    continue;
   let id = bl.getAttribute('data-id');
   if (findID !== id)
    continue;
   tUI.destroy();
   Pang_Blacklist.uis.slice(i, 1);
   break;
  }
 },
 observe: function(aSubject, aTopic, aData)
 {
  switch (aTopic)
  {
   case 'addon-options-displayed':
    if (aData === '{3B1A6514-0F92-572E-AE65-3BFBB55C4D68}')
     Pang_Blacklist.handleDisplayed(aSubject);
    break;
   case 'addon-options-hidden':
    if (aData === '{3B1A6514-0F92-572E-AE65-3BFBB55C4D68}')
     Pang_Blacklist.handleHidden(aSubject);
    break;
  }
 }
};

Pang_Blacklist.ui.prototype = {
 _prefTimer: null,
 prefBranch_changed: null,
 doc: null,
 _Prefs: Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getBranch('extensions.pang.'),
 getBranchPrefInterface: function (thisBranch)
 {
  if (typeof Components.interfaces.nsIPrefBranch2 == 'undefined' && typeof Components.interfaces.nsIPrefBranchInternal == 'undefined')
   return thisBranch.QueryInterface(Components.interfaces.nsIPrefBranch); // 60.0+ support
  else if (typeof Components.interfaces.nsIPrefBranch2 == 'undefined')
   return thisBranch.QueryInterface(Components.interfaces.nsIPrefBranchInternal); //1.0.x support
  else
   return thisBranch.QueryInterface(Components.interfaces.nsIPrefBranch2); // 1.5+ support
 },
 construct: function(doc)
 {
  this.doc = doc;
  let prefService = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService);
  if(!this.prefBranch_changed)
  {
   this.prefBranch_changed = prefService.getBranch('extensions.pang.');
   let pbi = this.getBranchPrefInterface(this.prefBranch_changed);
   pbi.addObserver('', this, false);
  }
  //add event listeners for buttons, textbox (enter), and listbox (delete)
  if (this.doc.getElementById('txtBlacklist') !== null)
   this.doc.getElementById('txtBlacklist').addEventListener('keypress', this, false);
  if (this.doc.getElementById('lstBlacklist') !== null)
   this.doc.getElementById('lstBlacklist').addEventListener('keypress', this, false);
  if (this.doc.getElementById('cmdBlacklistAdd') !== null)
   this.doc.getElementById('cmdBlacklistAdd').addEventListener('click', this, false);
  if (this.doc.getElementById('cmdBlacklistRemove') !== null)
   this.doc.getElementById('cmdBlacklistRemove').addEventListener('click', this, false);
  this.updateUI();
 },
 destroy: function()
 {
  if (this._prefTimer != null)
  {
   clearTimeout(this._prefTimer);
   this._prefTimer = null;
  }
  if(this.prefBranch_changed)
  {
   let pbi = this.getBranchPrefInterface(this.prefBranch_changed);
   pbi.removeObserver('', this);
   this.prefBranch_changed = null;
  }
  if (this.doc.getElementById('txtBlacklist') !== null)
   this.doc.getElementById('txtBlacklist').removeEventListener('keypress', this, false);
  if (this.doc.getElementById('lstBlacklist') !== null)
   this.doc.getElementById('lstBlacklist').removeEventListener('keypress', this, false);
  if (this.doc.getElementById('cmdBlacklistAdd') !== null)
   this.doc.getElementById('cmdBlacklistAdd').removeEventListener('click', this, false);
  if (this.doc.getElementById('cmdBlacklistRemove') !== null)
   this.doc.getElementById('cmdBlacklistRemove').removeEventListener('click', this, false);
 },
 add: function()
 {
  let lstBlacklist = this.doc.getElementById('lstBlacklist');
  if (lstBlacklist === null)
   return;
  let txtBlacklist = this.doc.getElementById('txtBlacklist');
  if (txtBlacklist === null)
   return;
  let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
  if (txtBlacklist.value.length < 1)
  {
   promptService.alert(this.doc.parentWindow, 'Pang Blacklist', 'No host to blacklist. Please enter a host to add.');
   return;
  }
  for (let i = 0; i < lstBlacklist.itemCount; i++)
  {
   if (lstBlacklist.getItemAtIndex(i).value.toLowerCase() === txtBlacklist.value.toLowerCase())
   {
    promptService.alert(this.doc.parentWindow, 'Pang Blacklist', 'The host "' + txtBlacklist.value + '" is already in the blacklist.');
    return;
   }
  }
  lstBlacklist.appendItem(txtBlacklist.value.toLowerCase(), txtBlacklist.value.toLowerCase());
  txtBlacklist.value = '';
  this.updatePref();
 },
 remove: function()
 {
  let lstBlacklist = this.doc.getElementById('lstBlacklist');
  if (lstBlacklist === null)
   return;
  let idx = lstBlacklist.selectedIndex;
  let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
  if (idx < 0)
  {
   promptService.alert(this.doc.parentWindow, 'Pang Blacklist', 'No blacklisted host selected. Please select a host.');
   return;
  }
  if (!promptService.confirm(this.doc.parentWindow, 'Pang Blacklist', 'Do you want to remove "' + lstBlacklist.getItemAtIndex(idx).value + '" from the Pang blacklist?'))
   return;
  lstBlacklist.removeItemAt(idx);
  this.updatePref();
  if (lstBlacklist.itemCount < 1)
   return;
  while (idx >= lstBlacklist.itemCount)
   idx--;
  lstBlacklist.selectedIndex = idx;
 },
 updateUI: function()
 {
  let lstBlacklist = this.doc.getElementById('lstBlacklist');
  if (lstBlacklist === null)
   return;
  while (lstBlacklist.itemCount > 0)
  {
   lstBlacklist.removeItemAt(0);
  }
  let sBlacklist = this._Prefs.getCharPref('blacklist').split(';');
  for (let i = 0; i < sBlacklist.length; i++)
  {
   if (sBlacklist[i].length < 1)
    continue;
   lstBlacklist.appendItem(sBlacklist[i], sBlacklist[i]);
  }
 },
 handlePrefChange: function(pref)
 {
  if (pref === 'blacklist');
   this.updateUI();
 },
 updatePref: function()
 {
  let sPref = '';
  let lstBlacklist = this.doc.getElementById('lstBlacklist');
  if (lstBlacklist === null)
   return;
  for (let i = 0; i < lstBlacklist.itemCount; i++)
  {
   sPref += lstBlacklist.getItemAtIndex(i).value + ';';
  }
  if (sPref.slice(-1) === ';')
   sPref = sPref.slice(0, -1);
  this._Prefs.setCharPref('blacklist', sPref);
 },
 observe: function(aSubject, aTopic, aData)
 {
  switch (aTopic)
  {
   case 'nsPref:changed':
    this.handlePrefChange(aData);
    break;
  }
 },
 QueryInterface: function(iid)
 {
  if (iid.equals(Components.interfaces.nsISupports))
   return this;
  throw Components.results.NS_ERROR_NO_INTERFACE;
 },
 createInstance: function(outer, iid)
 {
  if (outer)
   return Components.results.NS_ERROR_NO_AGGREGATION;
  return this.QueryInterface(iid);
 }
};

Pang_Blacklist.ui.prototype.handleEvent = function(event)
{
 switch(event.target.getAttribute('id'))
 {
  case 'txtBlacklist':
   if (event.type === 'keypress' && event.code === 'Enter')
    this.add();
   break;
  case 'lstBlacklist':
   if (event.type === 'keypress' && event.code === 'Delete')
    this.remove();
   break;
  case 'cmdBlacklistAdd':
   if (event.type === 'click')
    this.add();
   break;
  case 'cmdBlacklistRemove':
   if (event.type === 'click')
    this.remove();
   break;
 }
};