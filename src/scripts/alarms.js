import ext from './utils/utilitiesCrossBrowser';
import storage from './utils/utilitiesStorage';
import moment from 'moment-timezone';
import { getTimeStamp, safelyExecuteOnTab, safelyRemoveTab } from './utils/utilitiesAssistant';
import { getConfig, updateConfig, debugAO } from './config';

var previousStateOfSearchAlarm = '';
const CONST_PERIODIC_SEARCH_PROCESS_ALARM = 'periodic_search_process';
const CONST_SECONDS_IN_A_DAY = 24 * 60 * 60;

/*
  This function uses the previous scrape time to generate the next scrape time
*/
async function searchAlarmTimeNextInstance(interval) {
  return await new Promise((resolve, reject) => {
    storage.get('lastIndication', (result)=>{
      if (debugAO) { console.log("The value of the last indication is", result.lastIndication) }
      const currentTime = moment();
      if (result.lastIndication) {
        if (Math.abs(parseInt(result.lastIndication)-moment.utc().unix()) > (interval*60)) {
          // Run crawl immediately
          const timeWithOffset = moment();
          const currentMinutes = currentTime.minutes();
          timeWithOffset.minutes(currentMinutes + 1);
          if (debugAO) { console.log("There is", 1, "minute(s) until the next search process."); }
          resolve(timeWithOffset.valueOf());
        } else {
          // Run crawl according to last scrape
          const total_minutes_difference = Math.floor(((interval*60) - Math.abs(parseInt(result.lastIndication)-moment.utc().unix()))/60);
          const timeWithOffset = moment();
          const currentMinutes = currentTime.minutes();
          timeWithOffset.minutes(currentMinutes + total_minutes_difference);
          if (debugAO) { console.log("There are", total_minutes_difference, "minute(s) until the next search process."); }
          resolve(timeWithOffset.valueOf());
        }
      } else {
        // If there is no previous indication, set the indication
        storage.set({'lastIndication': getTimeStamp()}, () => {});
        // Run crawl with offset from current time
        const timeWithOffset = moment();
        const currentMinutes = currentTime.minutes();
        timeWithOffset.minutes(currentMinutes + interval);
        if (debugAO) { console.log("There are", interval, "minute(s) until the next search process."); }
        resolve(timeWithOffset.valueOf());
      }
    });
  });
}

/*
  This function suspends the search process - it's usually executed during a screen lock
*/
function searchAlarmSuspend() {
  ext.alarms.clear(CONST_PERIODIC_SEARCH_PROCESS_ALARM, ()=>{});
}

/*
  This function refreshes the search alarm, querying the config file to set the next interval
*/
function searchAlarmRefresh(firstTime=false) {
  updateConfig().then(config => {
    if (debugAO) { console.log("Loaded the config file into the searchAlarmRefresh function..."); }
    // Wipe the alarm
    ext.alarms.clear(CONST_PERIODIC_SEARCH_PROCESS_ALARM, ()=>{ 
      if (debugAO) { console.log("Cleared the pre-existing search alarm..."); }
      // The alarm has been wiped; reinstate it by the config file
      ext.alarms.get(CONST_PERIODIC_SEARCH_PROCESS_ALARM, a => {
        if (!a) {
          searchAlarmTimeNextInstance(config.runInterval).then((whenToRun)=>{
            if (firstTime) {
              whenToRun = moment().valueOf(); // Returned in miliseconds since the Epoch
            }
            ext.alarms.create(CONST_PERIODIC_SEARCH_PROCESS_ALARM, {
              when: whenToRun,
              periodInMinutes: config.runInterval
            });
            if (debugAO) { console.log("The next scrape will occur at", (whenToRun/1000)); }
            if (debugAO) { console.log("Set the new alarm to interval of ", config.runInterval, "minutes"); }
          });
        } else {
          // The alarm shouldn't exist after it has been deleted
          if (debugAO) { console.log("This shouldn't happen..."); }
        }
      });
    });
  });
}

/*
  This function evaluates whether the search alarm should invoke the search process
*/
function searchAlarmPassthrough() {
  // Retrieve the configuration file before the search starts
  getConfig().then(config => {
    // If the search process is running within the campaign time...
    const currentTime = moment().tz(moment.tz.guess());
    if (moment(config.startDate).isBefore(currentTime) && moment(config.endDate).isAfter(currentTime)) {
      // If we have a hash key, run the alarm
      storage.get('hash_key', (this_hash_key_object)=>{
        var has_hash_key = (this_hash_key_object.hash_key) ? true : false;
        if (has_hash_key) { 
          storage.get('pause24', (response)=>{
            // If the extension is not paused
            if ((!('pause24' in response)) || (('pause24' in response) && (!(response.pause24 - moment.utc().unix() > 0)))) {
              // Create the countdown tab...
              const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
              const options = isFirefox ? { url: ext.runtime.getURL(config.countdownPage) } : {};
              ext.tabs.create({ url: ext.runtime.getURL(config.countdownPage), active: false }, tab => {
                storage.set({'countDownTabId': tab.id}, () => {
                  // The invocation of the alarm is when the last scrape value is set
                  storage.set({'lastIndication': getTimeStamp()}, () => {});
                  if (debugAO) { console.log("The countdown tab has been opened, and so the countDownTabId has been set.") }
                });
              });
              if (debugAO) { console.log("The search alarm has succeeded in invoking the 'countdown' tab."); }
            } else {
              if (debugAO) { console.log("The search alarm did not execute because the 'pause' event has been invoked."); }
            }
          });
        } else {
          if (debugAO) { console.log("The search alarm did not execute because the hash key has not yet been determined."); }
        }
      });
    } else {
      if (debugAO) { console.log("The search alarm did not execute because the campaign interval is over."); }
    }
  });
}

/*
  This function is triggered whenever the state of the machine changes, and refreshes the search alarm accordingly
*/
function searchAlarmStateChangeListener(state) {
  // If the computer has initiated a screensaver or is locked, don't run the plugin
  if (state === 'locked') { 
    if (debugAO) { console.log("Suspending the alarm as the computer is now locked..."); }
    searchAlarmSuspend(); 
  }
  // Upon unlocking the computer, the alarm is refreshed
  if (state === 'active' &&  previousStateOfSearchAlarm === 'locked') { 
    if (debugAO) { console.log("Refreshing the search alarm for a state change event..."); }
    searchAlarmRefresh();
  }
  // The previous state is always set on state changes
  previousStateOfSearchAlarm = state;
}

/*
  This function returns the pause value, or null if it is overstepped/not set yet.
*/
async function searchAlarmPauseValue() {
  // Asynchronous wrapper
  return await new Promise((resolve, reject) => {
    // Get the current pause value
    storage.get('pause24', (response)=>{
      // If it exists...
      if ('pause24' in response) {
        // If the current time is smaller than the designated "pause until" time, 
        if (response.pause24 - moment.utc().unix() > 0) {
          // Return the pause value
          resolve(response.pause24);
        } else {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    }); 
  }); 
}

/*
  This function will check the current status of whether the search alarm is paused
*/
async function searchAlarmCheckPauseStatus() {
  // Asynchronous wrapper
  return await new Promise((resolve, reject) => {
    // Get the current pause status
    searchAlarmPauseValue().then((pauseValue)=>{
      // If the pause value is not set to null, return true
      if (pauseValue != null) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  }); 
}

/*
  This function will toggle the 'pause' status (pause for 24 hrs. or not), returning the new pause status
*/
async function searchAlarmPauseToggle(on=false) {
  return await new Promise((resolve, reject) => {
    // Get the current date (for setting the pause status)
    var dateVal = moment.utc().unix();
    searchAlarmCheckPauseStatus().then((pausedStatus)=>{
      // If the search alarm is paused (or not), toggle it
      if ((pausedStatus) && (!(on))) {
        dateVal -= CONST_SECONDS_IN_A_DAY;
      } else {
        dateVal += CONST_SECONDS_IN_A_DAY;
      }
      // Then set the new pause status, returning it back from the function
      storage.set({'pause24': dateVal }, () => {
        resolve(!pausedStatus);
      }); 
    });
  }); 
}

/*
  This checks if the countdown tab is valid, and if so, to which tab ID it belongs
*/
async function searchAlarmIsCountdownTabValid() {
  return await new Promise((resolve, reject) => {
    storage.get('countDownTabId', (result) => {
      safelyExecuteOnTab(result.countDownTabId).then((success) => {
        if (success) {
          resolve({ tabId : result.countDownTabId });
        } else {
          resolve({ tabId : null });
        }
      })
    });
  });
}

/*
  This function kills the countdown tab
*/
async function searchAlarmKillCountdownTab() {
  searchAlarmIsCountdownTabValid().then((result) => {
    safelyRemoveTab(result.tabId);
  })
}

/*
  This function invalidates the countDownTabId value to prevent re-activating
  a search process when the tab is accidentally opened

  NOTE: Only the countdown tab may invalidate the search process
*/
function searchAlarmInvalidateSearchProcess(tabId) {
  searchAlarmIsCountdownTabValid().then((countdownTab)=>{
    if (countdownTab.tabId == tabId) {
      // This is set to null for validation purposes
      storage.set({'countDownTabId': null}, () => {});
      if (debugAO) { console.log("The countdown tab has closed, and so countDownTabId has been set back to null.") }
    }
  })
}

/*
  This function evaluates a tab whenever it is created/updated, filtering
  countdown pages, and determining whether they should rightfully exist
*/
function searchAlarmEvaluateCountdownTab(queriedTab) {
  getConfig().then(config => {
    var countdownURL = ext.runtime.getURL(config.countdownPage);
    // If the tab is of the 'countdown' kind...
    var queriedTabURL = ('pendingUrl' in queriedTab) ? queriedTab.pendingUrl : queriedTab.url;
    if (queriedTabURL == countdownURL) {
      // Check the status of the search alarm...
      searchAlarmIsCountdownTabValid().then((countdownTab) => {
        var queriedTabId = ('tabId' in queriedTab) ? queriedTab.tabId : queriedTab.id;
        // If the tabId value is null, this means the user has manually invoked the tab, which shouldn't happen
        if (countdownTab.tabId == null) {
          safelyRemoveTab(queriedTabId); // There is no need to inform the user of anything for malformed tabs
          if (debugAO) { console.log("This tab has been created/updated outside of a search alarm"); }
        } else {
          // The tab IDs need to match in order for the tab to be of a rightfully executed state
          if (countdownTab.tabId == queriedTabId) {
            if (debugAO) { console.log("This tab has been created/updated as part of a search alarm"); }
          } else {
            safelyRemoveTab(queriedTabId); // There is no need to inform the user of anything for malformed tabs
            if (debugAO) { console.log("This tab has not been created/updated as part of the search alarm, but was opened at the same time"); }
          }
        }
      });
    }
  });
}

/*
  This function initiates all alarms
*/
function alarmsInit() {
  // Refresh the alarm on installation
  ext.runtime.onInstalled.addListener(searchAlarmRefresh);
  // Refresh the alarm on state changes
  ext.idle.onStateChanged.addListener(searchAlarmStateChangeListener);
  // Invalidate the search process when the countdown tab is removed
  ext.tabs.onRemoved.addListener(searchAlarmInvalidateSearchProcess)
  // Evaluate all countdown tabs on every page update
  ext.tabs.onUpdated.addListener((tabId, changeInfo, updatedTab)=>{
    searchAlarmEvaluateCountdownTab(updatedTab);
  })
  // Evaluate all countdown tabs on every page creation
  ext.tabs.onCreated.addListener((openedTab)=>{
    searchAlarmEvaluateCountdownTab(openedTab);
  })
  // When any alarm is fired...
  ext.alarms.onAlarm.addListener((alarm) => {
    switch (alarm.name) {
      // The search alarm is set to refresh on every scrape, every installation, and every state change that isn't set to lock
      case CONST_PERIODIC_SEARCH_PROCESS_ALARM: searchAlarmPassthrough(); break ;
    } 
  });
}

/* Export the module */
export default {
  alarmsInit,
  searchAlarmRefresh,
  searchAlarmPauseToggle,
  searchAlarmKillCountdownTab,
  searchAlarmCheckPauseStatus,
  searchAlarmTimeNextInstance,
  searchAlarmPauseValue 
}
