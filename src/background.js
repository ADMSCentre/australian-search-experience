import ext from './scripts/utils/utilitiesCrossBrowser';
import storage from './scripts/utils/utilitiesStorage';
import moment from 'moment-timezone';
import Async from 'async';
import SearchRoutine from './scripts/searchRoutine/searchRoutineMain';
import Alarms from './scripts/alarms';
import { apiConfig, getConfig, updateConfig, debugAO, CONST_OVERRIDE_REGISTRATION, CONST_BROWSER_TYPE } from './scripts/config';
import { makeId } from './scripts/utils/utilitiesAssistant';

const CONST_TIME_DELAY_REFOCUS_WINDOW_SEARCH_ROUTINE_MILISECONDS = 500;
const CONST_SEARCH_ROUTINE_WINDOW_WIDTH = 400;
const CONST_SEARCH_ROUTINE_WINDOW_HEIGHT = 400;
const CONST_SEARCH_ROUTINE_WINDOW_TOP_OFFSET = 20;

// Initiate the alarms and search routine modules
Alarms.alarmsInit();
SearchRoutine.searchRoutineInit();

/*
  This function handles the search routine
*/
function handleSearchRoutine() {
  // Before anything, update the configuration file from the server
  updateConfig().then((config) => {
    // Then determine the current window (so that we may re-focus it)
    ext.windows.getCurrent(window => {
      var currentWindowFocusedStatus = window.focused;
      //We then create another window for the search routine
      var windowProperties = {
          width: CONST_SEARCH_ROUTINE_WINDOW_WIDTH,
          height: CONST_SEARCH_ROUTINE_WINDOW_HEIGHT,
          top: window.height - CONST_SEARCH_ROUTINE_WINDOW_TOP_OFFSET,
          url: ext.runtime.getURL(config.searchProcessPage),
          focused: false
        };
      // The Firefox Browser does not support creating windows that are naturally unfocussed
      if (CONST_BROWSER_TYPE == 'firefox') {
        delete windowProperties.focused;
      }

      ext.windows.create(windowProperties, newWindow => {
        // We re-focus the original window
        newWindow.focused = false;
          // We set the focus back to the previous window
          setTimeout(function(){ 
            ext.windows.update(window.id, {focused: currentWindowFocusedStatus}); }, 
            CONST_TIME_DELAY_REFOCUS_WINDOW_SEARCH_ROUTINE_MILISECONDS);
          // And simultaneously, we begin the search routine
          SearchRoutine.searchRoutineBegin( config, newWindow.id, newWindow.tabs[0].id);
        });
      });
  });
}

/*
  This function runs once the plugin is installed 
*/
function mainEventOnInstalled(reasonInfo) {
  /*
    Only show the registration page and wipe the storage on installation
  */
  // Update the config file
  updateConfig().then(config => {
    storage.get('uniqueId', (result)=>{
      // If the unique ID has indeed not been set
      if (!('uniqueId' in result)) {
        // Then this is indeed the first runthrough
        // Generate the unique ID for this plugin
        if (reasonInfo.reason === 'install') {
          // Wipe the entire storage on true installation
          storage.clear(()=>{ if(ext.runtime.lastError) {} else {
            // Set the unique ID
            storage.set({'uniqueId': makeId()}, () => {});
            // Load the registration page
            ext.tabs.create({ url: config.introPage  }, tab => {});
          }});
        }
      }
    });
  });
}

/*
  This function runs whenever a message is received by the service worker
*/
function messageRouter(request, sender, sendResponse) {
  storage.get('hash_key', (this_hash_key_object)=>{
    var has_hash_key = (this_hash_key_object.hash_key) ? true : false;
    switch (request.action) {
      // Run a test search routine
      case 'test-search-routine': if ((has_hash_key || CONST_OVERRIDE_REGISTRATION)) { handleSearchRoutine(); } // There is currently a benign error that is caused when the test routine runs on an open search routine
      break ;
      // Mediate a search routine
      case 'mediate-search-routine' : SearchRoutine.mediateSearchRoutine();
      break ;
      // Catch the HTML of the pages we visit
      case 'catch-html' : storage.set({ 'caughtHTML': request.body }, () => {
        if (debugAO) { console.log("Visited a page during the search process; HTML caught: length: ",request.body.length); }
      }); break;
      // Force the next step of the search queue
      case 'force-search-routine-step' : 
        if (debugAO) { console.log("Running the next step in the search queue"); }
        SearchRoutine.searchRoutineRunNextStep();
      break;
      // Run the search routine from the countdown
      case 'run-from-countdown': 
        if (has_hash_key) { 
          // This switch case runs the search process after the countdown
          // Although the pause status is checked before the countdown, there is a possibility
          // that the user may pause the search process after the countdown starts and before 
          // it finishes, in which case a final check is conducted here.
          storage.get('pause24', (response)=>{
            // If the plugin is not paused
            if ((!('pause24' in response)) || (('pause24' in response) && (!(response.pause24 - moment.utc().unix() > 0)))) {
              // Execute the search process
              handleSearchRoutine();
            } else {
              if (debugAO) { console.log("The user paused the search Alarm after the countdown started and before it finished. The search process will not go ahead."); }
            }
            // The countdown tab is killed before setting the stored ID to null (which happens in the alarms module)
            Alarms.searchAlarmKillCountdownTab();
          });
        }
      break ;
      case 'provoke-initial-search-process' : 
        if (debugAO) { console.log("Activation code found! Setting now...", this_hash_key_object.hash_key); }
        if (debugAO) { console.log("The very first search process has been called"); }
        getConfig().then((config) => {
          // This step will reroute the task to 'run-from-countdown', via the Alarms module
          Alarms.searchAlarmRefresh(true);
          // Show the share page
          ext.tabs.create({ url: ext.runtime.getURL(config.sharePage), active: true }, tab => {});
        }); 
      break ;
    }
  });
}
// TODO Check this
/*
ext.runtime.onConnect.addListener((result)=>{
  //SearchRoutine.searchRoutineRunNextStep();
  console.log("Received connection: ", result);
});*/

ext.runtime.onConnect.addListener(function(port) {
    port.onMessage.addListener(messageRouter);
});


// We listen for the installation event 
ext.runtime.onInstalled.addListener(mainEventOnInstalled);
// We listen for the messaging event
//ext.runtime.onMessage.addListener(messageRouter);




