const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function onTabRemoved() {
	browser.alarms.get("activeModeAlarm")
	.then(function(alarm) {
		if(!alarm) {
			createActiveModeAlarm();
		}
	});
}


function enableActiveMode() {
	browser.tabs.onRemoved.addListener(onTabRemoved);
	console.log("ActiveMode");
}

function disableActiveMode() {
	browser.tabs.onRemoved.removeListener(onTabRemoved);
	console.log("DisabledMode");
}

function createActiveModeAlarm() {
	browser.storage.local.get("delayBeforeClean")
	.then(function(items) {
		let minutes = parseInt(items.delayBeforeClean, 10);
		console.log("Create Active Alarm: " + minutes);
		browser.alarms.create("activeModeAlarm",{
			delayInMinutes: minutes
		});
	}).catch(onError);
}
// ([a-z0-9]+[.])*example.com

function splitSubDomain(domain) {
	let relatedDomains = new Array();
	let splited = domain.split(".");
	relatedDomains.push(splited[splited.length - 2] + "." + splited[splited.length - 1])
	let j = 0;
	for(let i = splited.length - 3; i >= 0; i--) {
		let combined = splited[i] + "." +relatedDomains[j];
		relatedDomains.push(combined);
		j++;
	}
  
	return relatedDomains;
}

function extractMainDomain(domain) {
	let re = new RegExp('[a-z0-9|-]+\.[a-z]+$');
	//let t
	return re.exec(domain)[0];
}

function cleanCookies() {
	console.log("Cleaning");
	let setOfTabURLS = new Set();
	recentlyCleaned = 0;
	browser.tabs.query({})
	.then(function(tabs) {
		for(let i = 0; i < tabs.length; i++) {
			if (isAWebpage(tabs[i].url)) {
				let hostURL = getHostname(tabs[i].url);
				hostURL = extractMainDomain(hostURL);
				setOfTabURLS.add(hostURL);
			}
		}
		console.log(setOfTabURLS);
		return browser.cookies.getAll({});
	})
	.then(function(cookies) {
		for(let i = 0; i < cookies.length; i++) {
			let cookieDomain = cookies[i].domain;
			if(cookieDomain.charAt(0) == ".") {
				cookieDomain = cookieDomain.slice(1);
			}
			cookieDomain = cookies[i].secure ? "https://" + cookieDomain : "http://" + cookieDomain;
			let cookieDomainHost = getHostname(cookieDomain);
			cookieDomainHost = extractMainDomain(cookieDomainHost);
			if(!hasHost(cookieDomainHost) && !setOfTabURLS.has(cookieDomainHost)) {
				cookieDomain = cookieDomain + cookies[i].path;
				console.log("Original: " + cookies[i].domain + " CookieDomain: " + cookieDomain + " CookieDomainHost: " + cookieDomainHost);
				// url: "http://domain.com" + cookies[i].path
				browser.cookies.remove({
					url: cookieDomain,
					name: cookies[i].name
				});
				incrementCounter();
				recentlyCleaned++;
			}
		}
		showRecentlyCleanedInBadge();
	});

}


//Logs the error
function onError(error) {
	console.error(`Error: ${error}`);
}


//Returns the host name of the url. Etc. "https://en.wikipedia.org/wiki/Cat" becomes en.wikipedia.org
function getHostname(url) {
    var hostname = new URL(url).hostname;
    // Strip "www." if the URL starts with it.
    hostname = hostname.replace(/^www\./, '');
    return hostname;
}

function isAWebpage(URL) {
	if(URL.match(/^http:/) || URL.match(/^https:/)) {
		return true;
	}
	return false;
}

//See if the set has the url
function hasHost(url) {
	return cookieWhiteList.has(url);
}

//Stores the set in the local storage of the browser as an array
function storeLocal() {
	var urlArray = Array.from(cookieWhiteList);
	browser.storage.local.set({WhiteListURLS: urlArray});
}

//Add the url to the set
function addURL(url) {
	if(!hasHost(url)) {
		cookieWhiteList.add(url);
		storeLocal();
	} else {
		//console.log("Already have " + url);
	}

}

//Remove the url from the set
function removeURL(url) {
	cookieWhiteList.delete(url);
	storeLocal();
}

//Clears the set
function clearURL() {
	cookieWhiteList.clear();
	storeLocal();
}


//Increment the counter and store the counter to local after 1 minute
function incrementCounter() {
	browser.storage.local.get("statLoggingSetting")
	.then(function(items) {
		if(items.statLoggingSetting == true) {
			cookieDeletedCounterTotal++;
			cookieDeletedCounter++;
			browser.alarms.create("storeCounterToLocalAlarm", {
				delayInMinutes: 1
			});
		}
	}).catch(onError);
}

//Resets the counter
function resetCounter() {
	browser.storage.local.set({cookieDeletedCounterTotal: 0});
	cookieDeletedCounterTotal = 0;
	cookieDeletedCounter = 0;
}

//Stores the total history entries deleted to local
function storeCounterToLocal() {
	browser.storage.local.set({cookieDeletedCounterTotal: cookieDeletedCounterTotal});
}

//Sets up the background page on startup
function onStartUp() {
	browser.storage.local.get()
	.then(function(items) {
		cookieWhiteList = new Set(items.WhiteListURLS);
		//Checks to see if these settings are in storage, if not create and set the default
		if(items.delayBeforeClean == null) {
			browser.storage.local.set({delayBeforeClean: 1});
		} 	
		
		if(items.cookieDeletedCounterTotal == null) {
			resetCounter();
		} else {
			cookieDeletedCounterTotal = items.cookieDeletedCounterTotal;
		}		
		
		if(items.activeMode == null) {
			browser.storage.local.set({activeMode: false});
		} 	
		
		if(items.statLoggingSetting == null) {
			browser.storage.local.set({statLoggingSetting: true});
		}

		if(items.showRecentlyCleanedInIconSetting == null) {
			browser.storage.local.set({showRecentlyCleanedInIconSetting: true});
		}

		//Create objects based on settings
		if(items.activeMode == true) {
			enableActiveMode();
		} else {
			disableActiveMode();
		}

	}).catch(onError);
}


//Set the defaults 
function setDefaults() {
	browser.storage.local.clear();
	onStartUp();
}

//The set of urls
var cookieWhiteList;

var cookieDeletedCounterTotal;
var recentlyCleaned;
var cookieDeletedCounter = 0;

onStartUp();


function showRecentlyCleanedInBadge() {
	browser.browserAction.setBadgeText({text: recentlyCleaned.toString()});
	browser.browserAction.setBadgeBackgroundColor({color: "blue"});
} 

//Logic that controls when to disable the browser action
browser.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	if (tab.status == "complete") {
		browser.windows.getCurrent()
		.then(function(windowInfo) {
			if (!isAWebpage(tab.url) || windowInfo.incognito) {
				browser.browserAction.disable(tab.id);
				browser.browserAction.setBadgeText({text: "X", tabId: tab.id});
				browser.browserAction.setBadgeBackgroundColor({color: "red", tabId: tab.id});
			} else {
				browser.browserAction.enable(tab.id);
				browser.browserAction.setBadgeText({text: "", tabId: tab.id});
				// browser.storage.local.get("showRecentlyCleanedInIconSetting")
				// .then(function(items) {
				// 	if(items.showRecentlyCleanedInIconSetting == true) {
				// 		showRecentlyCleanedInBadge(tab.url, tab.id);
				// 	}	
				// });
			}
		}).catch(onError);
	}


});

//Alarm event handler
browser.alarms.onAlarm.addListener(function (alarmInfo) {
	console.log(alarmInfo.name);
	if(alarmInfo.name == "activeModeAlarm") {
		cleanCookies();
		browser.alarms.clear(alarmInfo.name);

	}
	if(alarmInfo.name == "storeCounterToLocalAlarm") {
		storeCounterToLocal();
	}

});
