import ext from '../utils/utilitiesCrossBrowser';
import storage from '../utils/utilitiesStorage';
import { apiConfig, debugAO, getConfig, CONST_BROWSER_TYPE, CONST_MANIFEST_VERSION_INTEGER, CONST_BROWSER_TOGGLE_FORCE } from '../config';
import moment from 'moment-timezone';
import { 
  makeId,
  getTimeStamp, 
  assistant_unicodeCharEscape, 
  assistant_Indexed,
  assistant_numberConversion,
  assistant_fuzzyViews, 
  assistant_dynamicHTML,
  assistant_fuzzyTime, 
  assistant_fuzzyDurationToSeconds, 
  assistant_youtubeURLClean,
  assistant_stripHTMLTags,
  assistant_deSlash,
  safelyRemoveWindow,
  safelyExecuteOnWindow,
  safelyExecuteOnTab,
  safelyRemoveTab,
  applyAssistantFunction,
  customFlagStandardBehaviourPositive,
  customFlagStandardBehaviourNegative,
  customFlagBehaviourRecursePositive,
  customFlagBehaviourRecurseNegative } from '../utils/utilitiesAssistant';

const reserved = [
      "_i",
      "_object",
      "platform",
      "url"
  ];

var previousStateOfSearchRoutine = '';
var ephemeralSearchRoutineElapsedTime;

const CONST_SEARCH_TOGGLE_INTERFACES = [
  'desktop',
  'mobile_iphone12pro',
  'mobile_galaxyS5'
]

const CONST_TIME_BEFORE_SEARCH_ROUTINE_QUEUE_STARTS_MILLISECONDS = 2000;
const CONST_TIME_BEFORE_SEARCH_ROUTINE_QUEUE_ELEMENT_LOADS_DOWN_MILLISECONDS = 61000;///10000;  //TODO Depreciated
const CONST_TIME_BEFORE_SEARCH_ROUTINE_QUEUE_ELEMENT_LOADS_UP_MILLISECONDS = 61000;//2000; 

var CONST_REGEX_CUSTOM_FLAGS = {
  "DESLASH" : [customFlagStandardBehaviourPositive, customFlagStandardBehaviourNegative],
  "YOUTUBE_URL_CLEAN" : [customFlagStandardBehaviourPositive, customFlagStandardBehaviourNegative],
  "DYNAMIC_HTML" : [customFlagStandardBehaviourPositive, customFlagStandardBehaviourNegative],
  "STRIP_HTML" : [customFlagStandardBehaviourPositive, customFlagStandardBehaviourNegative],
  "NULL" : [customFlagStandardBehaviourPositive, customFlagStandardBehaviourNegative],
  "NUMBER" : [customFlagStandardBehaviourPositive, customFlagStandardBehaviourNegative],
  "UNESCAPE" : [customFlagStandardBehaviourPositive, customFlagStandardBehaviourNegative],
  "FZVIEWS" : [customFlagStandardBehaviourPositive, customFlagStandardBehaviourNegative],
  "FZTIME" : [customFlagStandardBehaviourPositive, customFlagStandardBehaviourNegative],
  "FZDURATION" : [customFlagStandardBehaviourPositive, customFlagStandardBehaviourNegative],
  "INDEXED" : [customFlagStandardBehaviourPositive, customFlagStandardBehaviourNegative],
  "LISTIFY_MATCHES" : [customFlagStandardBehaviourPositive, customFlagStandardBehaviourNegative],
  "CONCATENATE_MATCHES" : [customFlagStandardBehaviourPositive, customFlagStandardBehaviourNegative],
  "NEWS_REMOVE_DOUBLEUPS" : [customFlagStandardBehaviourPositive, customFlagStandardBehaviourNegative],
  "NEWS_REMOVE_TAIL" : [customFlagStandardBehaviourPositive, customFlagStandardBehaviourNegative],
  "RECURSE" : [customFlagBehaviourRecursePositive, customFlagBehaviourRecurseNegative]
}

/*
  This function prevents users from accessing the search routine page when an instance is not running
*/
function mediateSearchRoutine() {
  if (debugAO) { console.log("A search process window has just opened; determining if it has been duly called..."); }
  // Get all tabs that have the desired URL...
  getConfig().then((config) => {
    ext.tabs.query({ "url" : ext.runtime.getURL(config.searchProcessPage) }, (tabManagerObject) => {
      if (debugAO) { console.log(`There are currently ${tabManagerObject.length} tabs that are of the search process kind`); }
      var searchRoutineReferenceObject = null;
      storage.get("searchRoutineReferenceObject", (result) => {
        if (("searchRoutineReferenceObject" in result) && (result.searchRoutineReferenceObject != null)) {
          searchRoutineReferenceObject = result.searchRoutineReferenceObject;
        }
        // Remove all tabs that are not associated with the reference object of the search routine (if it exists ofcourse)
        var tabsRemoved = 0;
        for (var i = 0; i < tabManagerObject.length; i ++) {
          if ((searchRoutineReferenceObject == null) || (tabManagerObject[i].id != searchRoutineReferenceObject["tabId"])) {
            safelyRemoveTab(tabManagerObject[i].id);
            tabsRemoved ++;
          }
        }
        if (debugAO) { console.log(`Attempted removal of ${tabsRemoved} tabs`); }
      });
    });
  });
}

/*
  This function begins the search routine, by organising all the alarms for the future events
*/
function searchRoutineBegin(config, argWindowId, argTabId, argPluginInstanceId) {
  // Before the new search routine begins, the plugin checks if there is a preexisting search routine; if so,
  // it runs searchRoutineCleanUp, waits for its completion, and then starts
  searchRoutineCleanUp().then(()=>{
    // The window and tab ID of the search process are the first thing to be recorded
    var searchRoutineReferenceObject = {
      "windowId" : argWindowId,
      "tabId" : argTabId,
      "pluginInstanceId" : argPluginInstanceId,
      "timeOfInitiationUNIX" : moment().valueOf(),
      "interfaceToggle" : null,
      "selectorsType" : null,
      "searchRoutineQueueSettings" : [],
      "searchRoutineQueueEndingAlarm" : null
    }
    // We get the 'interfaceToggle' value to determine whether this is a 'desktop' or 'mobile' search process
    storage.get('interfaceToggle', (result)=>{
      // If the 'interfaceToggle' value has not been set prior...
      var interfaceToggle_i;
      if (!('interfaceToggle' in result)) {
        // Then this is the first search process ever
        interfaceToggle_i = 0;
      } else {
        // Otherwise, determine the index of the next search process interface (and adjust the value to the initial value once the limit has been exceeded)
        var interfaceToggle_i = (CONST_SEARCH_TOGGLE_INTERFACES.indexOf(result.interfaceToggle)+1) % (CONST_SEARCH_TOGGLE_INTERFACES.length);
      }
      searchRoutineReferenceObject["interfaceToggle"] = CONST_SEARCH_TOGGLE_INTERFACES[interfaceToggle_i]; // Set the ephemeral value as well for short-term reference
      
      if (CONST_BROWSER_TOGGLE_FORCE != null) {
        searchRoutineReferenceObject["interfaceToggle"] = CONST_BROWSER_TOGGLE_FORCE;
      }

      //searchRoutineReferenceObject["interfaceToggle"] = CONST_SEARCH_TOGGLE_INTERFACES[0]; // TODO Diagnostics
      // Set the persistent value for long-term reference
      if (debugAO) { console.log(`Beginning a search process of '${searchRoutineReferenceObject["interfaceToggle"]}' type...`); }
      storage.set({ 'ephemeralSearchRoutineElapsedTime': (new Date().getTime() / 1000) }, () => {});
      // Set the selectors in preparation for the search process
      searchRoutineReferenceObject["selectorsType"] = `selectors_${searchRoutineReferenceObject["interfaceToggle"]}`; 
      storage.set({'interfaceToggle': searchRoutineReferenceObject["interfaceToggle"] }, () => {});
      // The alarm beginning value is the current time plus a few seconds
      var alarmSettingCumulative = searchRoutineReferenceObject["timeOfInitiationUNIX"] + CONST_TIME_BEFORE_SEARCH_ROUTINE_QUEUE_STARTS_MILLISECONDS;
      // For every interface, keyword, and load type, generate a queue element
      for (var selectorElement_i = 0; selectorElement_i < config[searchRoutineReferenceObject["selectorsType"]].length; selectorElement_i ++) {
        for (var keywordElement_i = 0; keywordElement_i < config["keywords"].length; keywordElement_i ++) {
          for (var loadType_i = 0; loadType_i < 2; loadType_i ++) {
            // Cumulatively set the alarm times
            alarmSettingCumulative += (Boolean(loadType_i) ? 
              CONST_TIME_BEFORE_SEARCH_ROUTINE_QUEUE_ELEMENT_LOADS_DOWN_MILLISECONDS : 
              CONST_TIME_BEFORE_SEARCH_ROUTINE_QUEUE_ELEMENT_LOADS_UP_MILLISECONDS);
            // Generate all members of the queue
            searchRoutineReferenceObject["searchRoutineQueueSettings"].push({
              "id" : makeId(),
              "tabId" : null, // This will eventually be instantiated
              "platform" : config[searchRoutineReferenceObject["selectorsType"]][selectorElement_i]["platform"],
              "interface" : searchRoutineReferenceObject["interfaceToggle"],
              "keyword" : config["keywords"][keywordElement_i],
              "loadType" : (Boolean(loadType_i) ? "loadDown" : "loadUp"),
              "alarmSetting" : alarmSettingCumulative
            });
          }
        }
      }

      /* TODO Remove preset alarms
      //Set all upcoming alarms
      for (var alarmSetting_i = 0; alarmSetting_i < searchRoutineReferenceObject["searchRoutineQueueSettings"].length; alarmSetting_i ++) {
        // Only the 'when' parameter is set, as the alarm only runs once
        ext.alarms.create(
          searchRoutineReferenceObject["searchRoutineQueueSettings"][alarmSetting_i]["id"], 
          { when: searchRoutineReferenceObject["searchRoutineQueueSettings"][alarmSetting_i]["alarmSetting"] });
        // Indicate the alarm that ends the search routine
        if (alarmSetting_i == (searchRoutineReferenceObject["searchRoutineQueueSettings"].length-1)) {
          searchRoutineReferenceObject["searchRoutineQueueEndingAlarm"] = searchRoutineReferenceObject["searchRoutineQueueSettings"][alarmSetting_i]["id"];
        }
      }*/

      // Action the first entry
      var searchRoutineQueuePositionStart = 0;
      storage.set({ 'searchRoutineQueuePosition': searchRoutineQueuePositionStart }, () => {
        searchRoutineAlarmAction(
        searchRoutineReferenceObject, 
        searchRoutineReferenceObject["searchRoutineQueueSettings"][searchRoutineQueuePositionStart]["id"], 
        searchRoutineReferenceObject["searchRoutineQueueSettings"][searchRoutineQueuePositionStart]);
      });
      // Set the ending alarm
      searchRoutineReferenceObject["searchRoutineQueueEndingAlarm"] = searchRoutineReferenceObject["searchRoutineQueueSettings"][(searchRoutineReferenceObject["searchRoutineQueueSettings"].length-1)]["id"];
      
      


      // Set the reference object before inactivity starts
      storage.set({"searchRoutineReferenceObject": searchRoutineReferenceObject }, () => {});
      if (debugAO) { console.log("The search routine has been initiated with the following reference object:", searchRoutineReferenceObject); }
      //searchRoutineInstance(0, _windowId, pluginId, windowRootTabId, callback);
    });
  });
}

/*
  This runs the next action in the search routine 
*/
function searchRoutineRunNextStep() {
  if (debugAO) {
    console.log("Attempting next step");
  }
  // Get the queue position...
  storage.get("searchRoutineQueuePosition", (result) => {
    if (debugAO) {
      console.log("searchRoutineQueuePosition", result.searchRoutineQueuePosition);
    }
    var alarm_i = result.searchRoutineQueuePosition;
    // Run the current position of the queue
    storage.get("searchRoutineReferenceObject", (result) => {
      // We check if the position belongs to the search routine
      if (("searchRoutineReferenceObject" in result) && (result.searchRoutineReferenceObject != null)) {
        var searchRoutineReferenceObject = result.searchRoutineReferenceObject;
        for (var i = alarm_i+1; i <= alarm_i+2; i ++) {
          if (i < searchRoutineReferenceObject["searchRoutineQueueSettings"].length) {
            searchRoutineAlarmAction(searchRoutineReferenceObject, searchRoutineReferenceObject["searchRoutineQueueSettings"][i]["id"], searchRoutineReferenceObject["searchRoutineQueueSettings"][i]); 
          }
        }
        storage.set({ 'searchRoutineQueuePosition': alarm_i+2 }, () => {});
        /*
        for (var i = 0; i < searchRoutineReferenceObject["searchRoutineQueueSettings"].length; i ++) {
          // If so...
          if (debugAO) {
            console.log("indexed ", searchRoutineReferenceObject["searchRoutineQueueSettings"][i]["id"]);
          }
          if (i == alarm_i) {
            if (debugAO) { console.log("A search routine queue alarm has been successfully detected:", searchRoutineReferenceObject["searchRoutineQueueSettings"][i]); }
            // We action the alarm
            if (debugAO) { console.log("Running next queue step for: ", searchRoutineReferenceObject["searchRoutineQueueSettings"][i]) };

            searchRoutineAlarmAction(searchRoutineReferenceObject, searchRoutineReferenceObject["searchRoutineQueueSettings"][alarm_i]["id"], searchRoutineReferenceObject["searchRoutineQueueSettings"][alarm_i]);
          }
        }
        */
      } else {
        // Otherwise, there is no search routine to index
      }
    });

  });

  
}

/*
  This function is called by the 'alarm' event listener of this module; it runs the search routine for a given page
*/
function searchRoutineAlarmAction(argSearchRoutineReferenceObject, searchRoutineQueueSettingsAlarmId, argSearchRoutineThisQueueSettingsObject) {
  var searchRoutineReferenceObject = argSearchRoutineReferenceObject;
  var searchRoutineThisQueueSettingsObject = argSearchRoutineThisQueueSettingsObject;
  var thisOutcomeObject = {
    "id" : searchRoutineQueueSettingsAlarmId,
    "didWindowExistOnAlarm" : true,
    "didTabExistOnAlarm" : true
  };
  // First check if the window exists
  safelyExecuteOnWindow(searchRoutineReferenceObject["windowId"]).then((successWindow)=>{
    if (successWindow) {
      // The window exists; now check if the tab exists
      safelyExecuteOnTab(searchRoutineReferenceObject["tabId"]).then((successTab)=>{
        if (successTab) {
          // The root tab exists
          getConfig().then((config) => {
            // If we are running a page load event...
            if (searchRoutineThisQueueSettingsObject["loadType"] == "loadUp") {
              // Generate the URL of the page to be visited
              var simulatedURL = setURL(config, 
                searchRoutineThisQueueSettingsObject["keyword"], 
                searchRoutineThisQueueSettingsObject["platform"], 
                searchRoutineThisQueueSettingsObject["interface"]);
              if (debugAO) { console.log("Executing a 'load up' event on the current search routine; URL is ", simulatedURL.url); }
              // If the URL did not generate an error...
              if (simulatedURL.error == null) {
                // Create the tab in the designated search routine window
                ext.tabs.create({
                  active: false,
                  url: simulatedURL.url,
                  windowId: searchRoutineReferenceObject["windowId"]
                }, tab => {
                  if(!ext.runtime.lastError) {
                    // Set the tab of the current search routine event to the newly created tab
                    searchRoutineThisQueueSettingsObject["tabId"] = tab.id;
                    // Then cycle through all events that are native to this interface, keyword, and platform...
                    for (var i = 0; i < searchRoutineReferenceObject["searchRoutineQueueSettings"].length; i ++) {
                      if ((searchRoutineReferenceObject["searchRoutineQueueSettings"][i]["interface"] == searchRoutineThisQueueSettingsObject["interface"]) &&
                          (searchRoutineReferenceObject["searchRoutineQueueSettings"][i]["keyword"]   == searchRoutineThisQueueSettingsObject["keyword"]) && 
                          (searchRoutineReferenceObject["searchRoutineQueueSettings"][i]["platform"]  == searchRoutineThisQueueSettingsObject["platform"])) {
                        // Record the tab ID by reinserting the object back into itself
                        searchRoutineReferenceObject["searchRoutineQueueSettings"][i]["tabId"] = searchRoutineThisQueueSettingsObject["tabId"];
                        storage.set({ "searchRoutineReferenceObject" : searchRoutineReferenceObject }, (outcome) => {
                          if (debugAO) { console.log("The search routine has duly identified the tab for this event:", searchRoutineReferenceObject); }
                        });
                      }
                    }
                  } else {
                    // We have to end early in case of a tab creation error TODO test
                    if (debugAO) { console.log("The search process is ending due to a tab creation error."); }
                    searchRoutineAlarmActionCallback(searchRoutineReferenceObject, searchRoutineQueueSettingsAlarmId, thisOutcomeObject, null, true);
                  }
                });
              } else {
                // We have to end early if the generated URL is not well-formed TODO test
                if (debugAO) { console.log("The search process is ending due to a malformed URL."); }
                searchRoutineAlarmActionCallback(searchRoutineReferenceObject, searchRoutineQueueSettingsAlarmId, thisOutcomeObject, null, true);
              }
            // Otherwise, if we are loading down a page we just visited...
            } else if (searchRoutineThisQueueSettingsObject["loadType"] == "loadDown") {
              if (debugAO) { console.log("Executing a 'load down' event on the current search routine"); }
              // Inject the script that will retrieve the HTML of the page
              try {
                storage.get('caughtHTML', (result)=>{
                  // Find the selectors that are specific to this interface and platform
                  var thisSelectors = null;
                  var candidateSelectors = config[`selectors_${searchRoutineThisQueueSettingsObject["interface"]}`];
                  for (var i = 0; i < candidateSelectors.length; i ++) {
                    if (candidateSelectors[i]["platform"] == searchRoutineThisQueueSettingsObject["platform"]) {
                      thisSelectors = candidateSelectors[i];
                    }
                  }
                  if (('caughtHTML' in result) && (result.caughtHTML != null)) {
                    var sanitisedHTML = result.caughtHTML;

                    // Unescaping is required for mobile devices
                    if ((searchRoutineReferenceObject["interfaceToggle"] != "desktop") 
                          && (searchRoutineThisQueueSettingsObject["platform"] == "youtube")) {
                      sanitisedHTML = assistant_unicodeCharEscape(assistant_unicodeCharEscape(result.caughtHTML));
                    }

                    var simpleCarriages = ["\n","\r","\t"];
                    for (var i = 0; i < simpleCarriages.length; i ++) {
                      sanitisedHTML = sanitisedHTML.replaceAll(simpleCarriages[i],"");
                    }
                    // If the selectors were found...
                    if (thisSelectors != null) {
                      if (debugAO) { 
                        console.log("The HTML of the page has returned:");
                        console.log({ "sanitisedHTML" : sanitisedHTML }); }
                      // Retrieve the evaluated results from the HTML
                      var results = evaluateHTML(thisSelectors,sanitisedHTML);
                      if (debugAO) { console.log("A result has been returned:", results); }
                      // Remove the tab of the page we just visited
                      safelyRemoveTab(searchRoutineThisQueueSettingsObject["tabId"]);
                      if (!(ext.runtime.lastError || results === undefined)) {
                        // Return the result back to the callback function, ready to be sent up to the server
                        searchRoutineAlarmActionCallback(
                          searchRoutineReferenceObject, 
                          searchRoutineQueueSettingsAlarmId, 
                          thisOutcomeObject,{ 
                            "results": results.data, 
                            "keyword": searchRoutineThisQueueSettingsObject["keyword"],
                            "platform": searchRoutineThisQueueSettingsObject["platform"],
                            "interface": searchRoutineThisQueueSettingsObject["interface"]
                          });
                      } else {
                        // Otherwise, we have to end early as the results are undefined, or the runtime error occurred TODO test
                        if (debugAO) { console.log("The search process is ending due because the search results are not well-defined OR there is a runtime error."); }
                        searchRoutineAlarmActionCallback(searchRoutineReferenceObject, searchRoutineQueueSettingsAlarmId, thisOutcomeObject, null, true);
                      }
                    }else {
                      // Otherwise, we have to end early as the selectors were not found TODO test
                      if (debugAO) { console.log("The search process is ending because the selectors were not found."); }
                      searchRoutineAlarmActionCallback(searchRoutineReferenceObject, searchRoutineQueueSettingsAlarmId, thisOutcomeObject, null, true);
                    }
                  } else {
                    // Otherwise, we have to end early as the HTML was not returned to us
                    if (debugAO) { console.log("The search process is ending as no HTML was returned."); }
                    searchRoutineAlarmActionCallback(searchRoutineReferenceObject, searchRoutineQueueSettingsAlarmId, thisOutcomeObject, null, true);
                  }
                });
              } catch (e) {
                if (debugAO) { console.log(e); }
                // The entire process of injecting scripts can be a little indeterminate, so we catch errors and end the process early
                if (debugAO) { console.log("The search process is ending due to an indeterminate error."); }
                searchRoutineAlarmActionCallback(searchRoutineReferenceObject, searchRoutineQueueSettingsAlarmId, thisOutcomeObject, null, true);
              }
            }
          });
        } else {
          // The root tab does not exist and so the search routine must be ended early
          thisOutcomeObject["didTabExistOnAlarm"] = false;
          if (debugAO) { console.log("The search process is ending due to the non-existence of the root tab."); }
          searchRoutineAlarmActionCallback(searchRoutineReferenceObject, searchRoutineQueueSettingsAlarmId, thisOutcomeObject, null, true);
        }
      });
    } else {
      // The window does not exist; tab existence is also implied as false; the search routine must be ended early
      thisOutcomeObject["didWindowExistOnAlarm"] = false;
      thisOutcomeObject["didTabExistOnAlarm"] = false;
      if (debugAO) { console.log("The search process is ending due to the non-existence of the root window."); }
      searchRoutineAlarmActionCallback(searchRoutineReferenceObject, searchRoutineQueueSettingsAlarmId, thisOutcomeObject, null, true);
    }
  });
}

/*
  This function runs the callback for both successful and unsuccessful search routine instances
*/
function searchRoutineAlarmActionCallback(searchRoutineReferenceObject, searchRoutineQueueSettingsAlarmId, thisOutcomeObject, results, endingEarly=false) {
  // Before anything, we attempt to post the results to the server (don't worry, it has a 'null' catcher)
  searchRoutinePostOutcome(results).then((success) =>{
    if (success) {
      if (debugAO) { console.log("The search routine has executed accordingly."); }
    } else {
      if (debugAO) { console.log("The search routine did not execute accordingly; failed on post."); }
    }
    storage.get('ephemeralSearchRoutineElapsedTime', (result)=>{
      try {
        if (('ephemeralSearchRoutineElapsedTime' in result) && (result.ephemeralSearchRoutineElapsedTime != null)) {
          if (debugAO) { console.log(`Search routine finished in ${Math.abs((new Date().getTime() / 1000) - parseFloat(result.ephemeralSearchRoutineElapsedTime))} seconds.`); }
          storage.set({ 'ephemeralSearchRoutineElapsedTime': null}, () => {});
        } 
      } catch (e) {}
    });
    // Then the remaining task are actioned...
    // Run the cleanup if the alarm is recognised as the last in the queue
    if (searchRoutineReferenceObject["searchRoutineQueueEndingAlarm"] == searchRoutineQueueSettingsAlarmId) {
      if (debugAO) { console.log("Search routine instance has finished with following outcomes:", results); }
      searchRoutineCleanUp();
    }
    // Also run the cleanup if we are finishing early
    if (endingEarly) {
      if (debugAO) { console.log("Due to user intervention, the search routine is ending early."); }
      if (debugAO) { console.log("Search routine instance has finished early with following outcomes:", results); }
      searchRoutineCleanUp();
    }
  })
}

/*
  This function posts the search routine values to the server
*/
async function searchRoutinePostOutcome(thisOutcome) {
  return await new Promise((resolve, reject) => {
    // If the value provided is null, it just means that this is part of an early ending routine
    if (thisOutcome == null) {
      resolve(true);
    } else {
      // Otherwise, we are actually sending data up
      storage.get('hash_key', (this_hash_key_object)=>{
        storage.get('uniqueId', function(result){
          getConfig().then(config => {
            fetch(apiConfig.resultUrl, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                "version" : ext.runtime.getManifest().version,
                "hash_key" : (this_hash_key_object.hash_key ? this_hash_key_object.hash_key : null),
                "user_agent" : (navigator ? navigator.userAgent : null),
                "browser" : CONST_BROWSER_TYPE,
                "keyword" : thisOutcome.keyword,
                "interface" : thisOutcome.interface,
                "platform" : thisOutcome.platform,
                "plugin_id" : (result.uniqueId ? result.uniqueId : null),
                "time_of_retrieval" : getTimeStamp(),
                "localisation" : (navigator ? navigator.language : null),
                "data" : thisOutcome.results,
                "event" : "collection"
              })
            }).then(response => {
              resolve(true);
            }).catch(error => {
              resolve(false);
            });
          });
        });
      });
    }
  });
}

/*
  This function cleans up the search routine (for both successful and unsuccessful cases)
*/
async function searchRoutineCleanUp() {
  return await new Promise((resolve, reject) => {
    storage.get("searchRoutineReferenceObject", (result) => {
      if (("searchRoutineReferenceObject" in result) && (result.searchRoutineReferenceObject != null)) {
        var searchRoutineReferenceObject = result.searchRoutineReferenceObject;
        if (debugAO) { console.log("A search routine has been found; preparing to wipe it..."); }
          // Remove all tabs for open searches
          for (var i = 0; i < searchRoutineReferenceObject["searchRoutineQueueSettings"].length; i ++) {
            if (('tabId' in searchRoutineReferenceObject["searchRoutineQueueSettings"][i]) 
                && (searchRoutineReferenceObject["searchRoutineQueueSettings"][i]["tabId"] != null)) {
              safelyRemoveTab(searchRoutineReferenceObject["searchRoutineQueueSettings"][i]["tabId"]);
            } 
          }
          // Remove the tab and window associated with the search routine 
          // Note: The actions are done separately in case the user has split both elements apart.
          safelyRemoveTab(searchRoutineReferenceObject["tabId"]);
          safelyRemoveWindow(searchRoutineReferenceObject["windowId"]);

          // Set the caught HTML to null
          storage.set({ 'caughtHTML': null }, () => {});
        
        if (debugAO) { console.log("All tabs and windows associated with the search routine have been removed."); }
        // Wipe the reference object
        if (debugAO) { console.log("The search routine reference object has been wiped."); }
        storage.set({"searchRoutineReferenceObject": null }, () => {
          resolve(-1);
        });
      } else {
        if (debugAO) { console.log("No prior search routine has been found; proceeding..."); }
        resolve(-1);
      }
    });
  });
}

/*
  This function dynamically sets the URL for the upcoming page of the search routine
*/
function setURL(config, keyword, platform, browserInterface) {
   var error = null;
   var outputUrl;
   // Firstly determine the URL template by cycling through the config JSON file, and matching the selector
   for (var i = 0; i < config[`selectors_${browserInterface}`].length; i ++) {
    if (config[`selectors_${browserInterface}`][i]["platform"] == platform) {
      outputUrl = config[`selectors_${browserInterface}`][i]["url"];
    }
   }
   // If the selector was not found, give a note of the error
   if (outputUrl === undefined) {
    error = "The URL template was not found.";
   }
   // Set the dynamic values, which will be injected into the URL
   var dynamic_values = {
     "DYNAMIC_OPTIONS_KEYWORD" : null,
     "DYNAMIC_NAVIGATOR_LANGUAGE" : navigator.language
   }
   // Set the keywords value, which requires encoding (for things like spaces and special characters)
   try {
     dynamic_values["DYNAMIC_OPTIONS_KEYWORD"] = encodeURI(keyword);
     for (var key in dynamic_values) {
        if (dynamic_values.hasOwnProperty(key)) {    
           outputUrl = outputUrl.replaceAll(String(key), String(dynamic_values[key]));     
        }
     }
   } catch (e) {
     error = String(e);
   }
   // Then finally apply the injected query parameters to spoof mobile devices and wipe the page
   if (outputUrl.indexOf("?") == -1) {
    outputUrl += `?ase_injection_interface=${browserInterface}&ase_injection_wipe=true`;
   } else {
    outputUrl += `&ase_injection_interface=${browserInterface}&ase_injection_wipe=true`;
   }
   return { "url" : outputUrl, "error" : error }
}

/*
  This function returns the raw HTML of the page being visited
*/
function returnRawHTML() {
  return document.documentElement.innerHTML.replace(/[\n\r]/g, '');
}

/*
  This function applies the various assistant functions to the retrieved value of a scrape
*/
function applyAssistantFunctionBulk(arg_retrieved_val_item, flagActivationObject) {
  var retrieved_val_item = arg_retrieved_val_item;
  // Apply deslash
  retrieved_val_item = applyAssistantFunction(flagActivationObject["DESLASH"], assistant_deSlash, retrieved_val_item);
  // Apply YOUTUBE_URL_CLEAN URL cleaning
  retrieved_val_item = applyAssistantFunction(flagActivationObject["YOUTUBE_URL_CLEAN"], assistant_youtubeURLClean, retrieved_val_item);
  // Apply STRIP_HTML flag
  retrieved_val_item = applyAssistantFunction(flagActivationObject["STRIP_HTML"], assistant_stripHTMLTags, retrieved_val_item);
  // Apply UNICODE unescaping
  retrieved_val_item = applyAssistantFunction(flagActivationObject["UNESCAPE"], assistant_unicodeCharEscape, retrieved_val_item);
  // Dynamic HTML
  retrieved_val_item = applyAssistantFunction(flagActivationObject["DYNAMIC_HTML"], assistant_dynamicHTML, retrieved_val_item);
  // Convert phonetic view counts into integer view count values
  retrieved_val_item = applyAssistantFunction(flagActivationObject["FZVIEWS"], assistant_fuzzyViews, retrieved_val_item);
  // Convert time values into Locale String timestamps
  retrieved_val_item = applyAssistantFunction(flagActivationObject["FZTIME"], assistant_fuzzyTime, retrieved_val_item);
  // Convert durations into integer second values
  retrieved_val_item = applyAssistantFunction(flagActivationObject["FZDURATION"], assistant_fuzzyDurationToSeconds, retrieved_val_item);
  // Run the index checker 
  retrieved_val_item = applyAssistantFunction(flagActivationObject["INDEXED"], assistant_Indexed, retrieved_val_item);
  // Apply NUMBER conversion
  retrieved_val_item = applyAssistantFunction(flagActivationObject["NUMBER"], assistant_numberConversion, retrieved_val_item);
  return retrieved_val_item;
}

/*
  This function synthesizes the set of items returned by the selector, and recurses if need be
*/
function synthesizeItemSet(argDictionary, suppliedHTML) {
  // Grab the HTML for the item key of the dictionary
  var thisReturnData = Object();
  var itemsListHTML;
  var renderAsList = false;
  if ("_i" in argDictionary) {
    itemsListHTML = retrieveElemFallback(argDictionary, "_i", suppliedHTML, "list");
    renderAsList = true;
  } else {
    if ("_object" in argDictionary) {
      itemsListHTML = retrieveElemFallback(argDictionary, "_object", suppliedHTML, "list");
    } else {
      itemsListHTML = [suppliedHTML]; // Passthrough
    }
  }

  // Prior to analysis, attempt to apply a listifier if we are dealing with an object
  if ("_object" in argDictionary) {
    if (itemsListHTML.constructor === String) {
      itemsListHTML = [itemsListHTML];
    }
  }

  try {
    // If the items are well-defined and are of the array kind...
    if ((itemsListHTML != null) && (itemsListHTML.constructor === Array)) {
      var data = Object();
      if (renderAsList) {
        data = [];
      }
      // Then populate the list with the fallbacks of all sub-items
      for (var i = 0; i < itemsListHTML.length; i++) {
          var new_item = {}
          for (var k in argDictionary) {

              if ((argDictionary.hasOwnProperty(k)) && (reserved.indexOf(k) == -1)) {
                if (argDictionary[k].constructor === Object) {
                  // This block enables item recursion
                  new_item[k] = synthesizeItemSet(argDictionary[k], itemsListHTML[i]);
                } else {
                  new_item[k] = retrieveElemFallback(argDictionary, k, itemsListHTML[i], "element");
                }
              }
          }

          if (renderAsList) {
            data.push(new_item)
          } else {
            data = new_item;
          }
      }
      thisReturnData = data;
    } else {
      // Return this if the items did not come back correctly
      thisReturnData = "Items came back as null";
    }
  } catch (e) {
    if (debugAO) { console.log("Caught an error at point 6.") }
    thisReturnData = String(e);
  }
  return thisReturnData;
}

/*
  This sub-function works with the config JSON file to match values to their selectors (or the fallbacks of the selectors)
*/
function retrieveElemFallback(source, selector_part, item, type) {
  var selector_i = 0;
  var elem_default_val = (type == "list") ? [] : null;
  var elem = elem_default_val;
  var keep_looping = true;
  // If the selector in question isn't undefined, run the process, otherwise, return the default value
  if (source[selector_part] != undefined) {
    // Run through all fallbacks
    while ((selector_i < source[selector_part].length) && (keep_looping)) {
      try {
        try {
          var retrieved_val = null;
          // Map the custom regex flags to the flag activation object
          var flagActivationObject = Object();
          // For every flag, set it to false initially
          for (var k in CONST_REGEX_CUSTOM_FLAGS){ flagActivationObject[k] = false; }
          try {
            // Grab the current selector fallback
            var expressionsToEvaluate = source[selector_part][selector_i];
            // Remove prestrings
            var preString = expressionsToEvaluate.match(/(-{).*?(}-)/gm);
            if (preString != null) {
              expressionsToEvaluate = expressionsToEvaluate.replaceAll(preString,"");
              preString = preString[0].replaceAll("-{","").replaceAll("}-","");
            }
            // Set the custom Regex flags and remove them from the expression to be evaluated
            for (var k in flagActivationObject) { 
              flagActivationObject[k] = (expressionsToEvaluate.indexOf(`[FLAG_${k}]`) != -1);
              expressionsToEvaluate = CONST_REGEX_CUSTOM_FLAGS[k][flagActivationObject[k] ? 0 : 1](expressionsToEvaluate, k);
            }
            // Return null if the null flag is activated...
            if (flagActivationObject["NULL"]) {
              retrieved_val = null;
            } else {
              // Otherwise, begin the attempt to retrieve the value
              var attempted_retrieved_val;
              /*/ Depending on the routine, we might be indexing a list or an item of a list, 
              // and this affects the way the value is interpreted
              if (type == "list") {
                // List routine
                attempted_retrieved_val = rawHTML;
              } else {
                // Item routine
                attempted_retrieved_val = item;
              }*/
              attempted_retrieved_val = item;
              try {
                for (var i = 0; i < expressionsToEvaluate.length; i ++) {
                  // For all expressions that need to be evaluated
                  if ((flagActivationObject["LISTIFY_MATCHES"]) && (i == (expressionsToEvaluate.length-1))) {
                    // If all expressions have been evaluated, listify the matches
                    attempted_retrieved_val = attempted_retrieved_val.match(RegExp(expressionsToEvaluate[i], "g", "m"));
                    // If we are dealing with an instance that removes the double-ups of news articles
                    if (flagActivationObject["NEWS_REMOVE_DOUBLEUPS"]) {
                      var attempted_retrieved_val_adjusted = []; // This is where we will put the successful entries
                      var textCatch = "(?<=\"],\").*?(?=\")"; // This is what we will use to extract the uniqueness (formally, its the title selector for the Google News mobile scraper)
                      for (var j = 0; j < attempted_retrieved_val.length; j ++) {
                        if ((j == attempted_retrieved_val.length-1) || (attempted_retrieved_val[j].match(RegExp(textCatch, "g", "m"))[0] != attempted_retrieved_val[j+1].match(RegExp(textCatch, "g", "m"))[0])) {
                          attempted_retrieved_val_adjusted.push(attempted_retrieved_val[j]);
                        }
                      }
                      attempted_retrieved_val = attempted_retrieved_val_adjusted;
                    }
                    if (flagActivationObject["NEWS_REMOVE_TAIL"]) {
                      // This is a specialised flag for the mobile Google news that pops the last element of an array
                      attempted_retrieved_val.pop();
                    }
                  } else if ((flagActivationObject["CONCATENATE_MATCHES"]) && (i == (expressionsToEvaluate.length-1))) {
                    // If all expressions have been evaluated, concatenate the matches
                    attempted_retrieved_val = attempted_retrieved_val.match(RegExp(expressionsToEvaluate[i], "g", "m")).join("");
                  } else {
                    // Return the basic match
                    attempted_retrieved_val = attempted_retrieved_val.match(RegExp(expressionsToEvaluate[i], "g", "m"))[0];
                  }
                }
              } catch (e) { 
                // It is a requirement that the 'attempted_retrieved_val' is wiped to preserve the functionality of the INDEXED flag
                if (flagActivationObject["LISTIFY_MATCHES"]) {
                  attempted_retrieved_val = []; 
                } else {
                  attempted_retrieved_val = null; 
                }
              }
              // Prepare the value to be returned
              retrieved_val = attempted_retrieved_val;

              // Note: The applyAssistantFunctionBulk function anticipates listified content
              retrieved_val = applyAssistantFunctionBulk(retrieved_val, flagActivationObject);

              // Prepend the prestring
              if (preString != null) {
                retrieved_val = preString+retrieved_val;
              }
            } 
          } catch (e) {
            //if (debugAO) { console.log(e); } // Diagnostic
          }
          /*
          // If this is an index check, adjust the value
          if (flagActivationObject["INDEXED"]) {
              retrieved_val = (retrieved_val != null);
          }*/
          // Set the element if the retrieved_val variable is acceptable
          if ( (retrieved_val.constructor === Boolean) ||
               (retrieved_val.constructor === String) ||
               (retrieved_val.constructor === Number) ||
               (retrieved_val  === parseInt(retrieved_val, 10)) ||
                ((retrieved_val != null) && (retrieved_val.length > 0))) {
            elem = retrieved_val;
          }
        } catch (e) {
          // In the event that an expression does not return anything meaningful, set the element to the default value
          elem = elem_default_val;
        }
        // If we are dealing with a list...
        if ((elem_default_val != null) && (elem_default_val !== undefined) && (elem != null) && (elem.length > 0)) {
          keep_looping = false;
        }
        // If we are dealing with an item...
        if ((elem_default_val == null) && (([null, NaN, ""]).indexOf(elem) == -1)) {
          keep_looping = false;
        }
      } catch (e) {
        //if (debugAO) { console.log(e); } // Diagnostic
        // This kind of error constitutes an issue in the expression evaluation block, and needs to be checked
        elem = String(e);
      }
      // The selector is shifted forward in the case of bad expression evaluations
      selector_i++;
    }
  }
  return elem;
}

/*
  This function takes the raw HTML of the visited page, and returns the metadata that we are interested in
*/
function evaluateHTML(selector, rawHTML) {
  // We record all errors that occurred during the process, along with the data we require
  var returnData = Object();
  // The previous function is applied to the process that attempts to construct 
  // the values to be sent back to the server
  try {
    // If the result is not malformed (we expect an 'items' value in every selector)

    if ("items" in selector) {
      // For every key in the selector
      returnData = synthesizeItemSet(selector.items, rawHTML);
    }
  } catch (e) {
    // Do nothing
  }
  return { "data": returnData }
}

/*
  This function is triggered whenever the state of the machine changes, and cleans up the search routine accordingly
*/
function searchRoutineStateChangeListener(state) {
  // If the computer has initiated a screensaver or is locked, perform the cleanup
  if (state === 'locked') { 
    if (debugAO) { console.log("Cleaning the search routine as the computer is now locked..."); }
    searchRoutineCleanUp(); 
  }
  // Upon unlocking the computer, the alarm is refreshed
  if (state === 'active' &&  previousStateOfSearchRoutine === 'locked') { 
    if (debugAO) { console.log("Cleaning the search routine for a state change event..."); }
    searchRoutineCleanUp();
  }
  // The previous state is always set on state changes
  previousStateOfSearchRoutine = state;
}

/*
  This function routes the alarms associated with the search routine pages
*/
function searchRoutineInit() {
  // Whenever an alarm is retrieved...
  ext.alarms.onAlarm.addListener((alarm) => {
    storage.get("searchRoutineReferenceObject", (result) => {
      // We check if it belongs to the search routine
      if (("searchRoutineReferenceObject" in result) && (result.searchRoutineReferenceObject != null)) {
        var searchRoutineReferenceObject = result.searchRoutineReferenceObject;
        for (var i = 0; i < searchRoutineReferenceObject["searchRoutineQueueSettings"].length; i ++) {
          // If so...
          if (searchRoutineReferenceObject["searchRoutineQueueSettings"][i]["id"] == alarm.name) {
            if (debugAO) { console.log("A search routine queue alarm has been successfully detected:", searchRoutineReferenceObject["searchRoutineQueueSettings"][i]); }
            // We action the alarm
            searchRoutineAlarmAction(searchRoutineReferenceObject, alarm.name, searchRoutineReferenceObject["searchRoutineQueueSettings"][i]);
          }
        }
      } else {
        // Otherwise, there is no search routine to index
      }
    });
  });
  // Also, refresh the search routine on state changes
  ext.idle.onStateChanged.addListener(searchRoutineStateChangeListener);
  
  // Only execute if the manifest version is less than 3
  if (CONST_MANIFEST_VERSION_INTEGER < 3) {
    // Webrequest content
    ext.webRequest.onBeforeSendHeaders.addListener(function (details) {
      if (CONST_BROWSER_TYPE != 'chrome') {
        var overiddenUserAgentString = null;

        if (details.url.indexOf(`ase_injection_interface=mobile_iphone12pro`) != -1) {
          overiddenUserAgentString = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 QQ/8.5.0.635 V1_IPH_SQ_8.5.0_1_APP_A Pixel/1170 MiniAppEnable SimpleUISwitch/0 QQTheme/1000 Core/WKWebView Device/Apple(iPhone 12 Pro) NetType/WIFI QBWebViewType/1 WKType/1';
        }

        if (details.url.indexOf(`ase_injection_interface=mobile_galaxyS5`) != -1) {
          overiddenUserAgentString = 'Mozilla/5.0 (Linux; Android 8.0.0; SM-G960F Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.84 Mobile Safari/537.36';
        }

        if (overiddenUserAgentString != null) {
          // Attach the header that makes the browser think its a mobile device
          details.requestHeaders = details.requestHeaders.filter(function (rh) {
            return rh.name !== 'Referer';
          });
          // Push the headers to the request headers object
          details.requestHeaders.push({ name: 'User-Agent', value: overiddenUserAgentString });
          return { requestHeaders: details.requestHeaders };
        } else {
          return null;
        }
      }
    }, { urls: ["<all_urls>"] }, ["blocking", "requestHeaders"]);
  } 
}





/* Export the module */
export default {
  searchRoutineInit,
  searchRoutineBegin,
  mediateSearchRoutine,
  searchRoutineRunNextStep
}









