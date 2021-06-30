import storage from './utils/utilitiesStorage';
import ext from './utils/utilitiesCrossBrowser';

var debugAO = true;
var CONST_OVERRIDE_REGISTRATION = true;
var CONST_BROWSER_TOGGLE_FORCE = "desktop";
var CONST_WIPE_OVERRIDE = true;
var CONST_BROWSER_TYPE = 'chrome';
var CONST_SERVER_OVERRIDE = 'serverConfigAlt3'
const CONST_MANIFEST_VERSION_INTEGER = ext.runtime.getManifest().manifest_version;

// Set the plugin to production mode:
const CONST_PRODUCTION = true;

if (CONST_PRODUCTION) {
  debugAO = false;
  CONST_OVERRIDE_REGISTRATION = false;
  CONST_BROWSER_TOGGLE_FORCE = null;
  CONST_WIPE_OVERRIDE = false;
  CONST_SERVER_OVERRIDE = 'serverConfigAlt2'
}

if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) { CONST_BROWSER_TYPE = 'firefox'; }
if (navigator.userAgent.match(/Opera|OPR\//)) { CONST_BROWSER_TYPE = 'opera'; }
if (navigator.userAgent.match(/Edge|Edg/)) { CONST_BROWSER_TYPE = 'edge'; }





export { debugAO, CONST_OVERRIDE_REGISTRATION, CONST_BROWSER_TYPE, CONST_MANIFEST_VERSION_INTEGER, CONST_WIPE_OVERRIDE, CONST_BROWSER_TOGGLE_FORCE }

export const apiConfig = {
  resultUrl: 'https://65i9k6fick.execute-api.us-east-2.amazonaws.com/aw-datenspende-api',
  configUrl: `https://aw-datenspende-bucket.s3.us-east-2.amazonaws.com/${CONST_SERVER_OVERRIDE}.json`,
  useServerConfig: true
};

// The default configuration is largely stripped
const defaultConfig = {
  "endDate": "2024-10-01T00:00:00+02:00",
  "startDate": "2017-07-05T00:00:00+02:00",
  "countdownPage": "pages/countdown.html",
  "sharePage": "pages/share.html",
  "searchProcessPage": "pages/search_process.html",
  "landingPage": "https://www.admscentre.org.au/searchexperience/",
  "introPage": "https://www.admscentre.org.au/searchexperience-register/",
  "registerPage": "https://www.admscentre.org.au/searchexperience-register/",
  "searchProcessInterval": 10000,
  "runInterval": 10,
  "keywords": [],
  "selectors_mobile_iphone12pro" : [],
  "selectors_mobile_galaxyS5" : [],
  "selectors_desktop" : []
};

/*
  This function retrieves the config file from storage
*/
export function getConfig() {
  return new Promise((resolve, reject) => {
    storage.get('config', function(result) {
      if (ext.runtime.lastError) {
        // If we get an error, return the configuration file
        return resolve(defaultConfig);
      }
      // If the response is well-formed, return it as the configuration file
      if (result.config && (Object.keys(result.config).length > 0 && result.config.constructor === Object)) {
        return resolve(result.config);
      } else {
        // Otherwise attempt to update the configuration file
        return resolve(updateConfig());
      }
    });
  });
}

/*
  This function updates the configuration file by querying the server
*/
export function updateConfig() {
  // Retrieve the config file (no caching it)
  function makeReq() {
    var thisRequestHeaders = new Headers({'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0'});
    return fetch(apiConfig.configUrl, { headers: thisRequestHeaders }).then(r => r.text()).then(result => {
        return JSON.parse(result);
    }).catch(error => { if (debugAO) { console.log("No internet connection OR the JSON is malformed..."); }});
  }
  // Then, if the returned config file is not malformed, return it to the plugin
  return makeReq().then(res => {
    if (res && (!(Object.keys(res).length === 0 && res.constructor === Object))) {
      storage.set({'config' : res}, ()=>{});
      return res;
    } else {
      // Or else, use the default configuration
      return defaultConfig;
    }
  });
}
