import ext from './utils/utilitiesCrossBrowser';
import { getConfig, debugAO, CONST_OVERRIDE_REGISTRATION, CONST_MANIFEST_VERSION_INTEGER } from './config';
import storage from './utils/utilitiesStorage';
import { renderNormaliseClockValue } from './utils/utilitiesAssistant';
import moment from 'moment-timezone';
import Alarms from './alarms';

const CONST_PAUSE_INDICATOR_RENDER_INTERVAL_SECONDS = 1000;

/*
  This function renders the 'pause timer' indication to the number of seconds remaining until the plugin resumes
*/
function renderPauseTimer() {
  // Firstly determine the value of the pause status
  Alarms.searchAlarmPauseValue().then((pauseValue)=>{
    // Convert the value into the remaining number of hours, minutes, and seconds (as normalised to add prepended zeros)
    const rawTimeUntil = pauseValue-moment.utc().unix();
    const numHours = renderNormaliseClockValue(Math.floor(parseInt(rawTimeUntil/60/60)));
    const numMinutes = renderNormaliseClockValue(Math.floor((rawTimeUntil - (numHours*60*60))/60));
    const numSeconds = renderNormaliseClockValue(Math.floor(rawTimeUntil - (numHours*60*60) - (numMinutes*60)));
    // Then apply the rendered amount to the visual indicator
    $("#buttonPauseFor24HoursRegisteredTimerValue").html(`${numHours}:${numMinutes}:${numSeconds}`);
    // And recurse the function through the renderTestRunButtonStatus function
    // This will enable a consistent check routine before every render instance
    setTimeout(() => {
      renderTestRunButtonStatus();
    }, CONST_PAUSE_INDICATOR_RENDER_INTERVAL_SECONDS);
  });
}

/*
  This function renders the pause button's status of the page intended for registered versions
*/
function renderTestRunButtonStatus() {
  // Firstly determine whether or not the plugin is paused...
  Alarms.searchAlarmCheckPauseStatus().then((paused)=>{
    // If it is paused...
    if (paused) {
      // Disable the 'Test run' button
      $("#buttonRunSearchProcessRegistered").addClass("disabled");
      // Show the 'pause status' timer
      $("#buttonPauseFor24HoursRegisteredTimer").collapse("show");
      // Set the label of the button to 'Unpause'
      $("#buttonPauseFor24HoursRegisteredLabel").html("UNPAUSE");
      // Set the 'pause status' timer indication...
      renderPauseTimer();
    } else {
      // Enable the 'Test run' button
      $("#buttonRunSearchProcessRegistered").removeClass("disabled");
      // Hide the 'pause status' timer
      $("#buttonPauseFor24HoursRegisteredTimer").collapse("hide");
      // Set the label of the button to 'Pause for 24 hours'
      $("#buttonPauseFor24HoursRegisteredLabel").html("PAUSE FOR 24 HOURS");
    }
  });
}

/*
  This function loads the page intended for unregistered versions of the plugin
*/
function loadPageRegistered() {
  // The loading animation is collapsed, and the page content shows
  $("#containerLoading").collapse("hide");
  $("#containerRegistered").collapse("show");
  renderTestRunButtonStatus();
  // Pressing the 'About this project' link directs the user to the introductory webpage
  $("#buttonAboutProjectRegistered").click(() => {
    getConfig().then((config) => { ext.tabs.create({ url: config.landingPage }); });
  });
  // If the user presses the 'Test run' button...
  $("#buttonRunSearchProcessRegistered").click(() => {
    // Check if the plugin is currently paused...
    Alarms.searchAlarmCheckPauseStatus().then((paused)=>{
      // If the plugin is not paused, run a search process
      if (!(paused)) {
        var port = ext.runtime.connect(ext.runtime.id);
        port.postMessage({ action: "test-search-routine" });
        //var action = 'test-search-routine';
        //ext.runtime.sendMessage({ action });
      }
    });
  });
  // If the user presses the 'Pause' button...
  $("#buttonPauseFor24HoursRegistered").click(() => {
    // Toggle the pause status of the plugin
    Alarms.searchAlarmPauseToggle().then((paused)=>{
      // And then render it in realtime
      renderTestRunButtonStatus();
    });
  });
}

/*
  This function loads the page intended for versions of the plugin that are outside of the campaign time.
*/
function loadPageFinished() {
  // The loading animation is collapsed, and the page content shows
  $("#containerLoading").collapse("hide");
  $("#containerFinished").collapse("show");
}

/*
  This function loads the page intended for unregistered versions of the plugin
*/
function loadPageUnregistered() {
  // The loading animation is collapsed, and the page content shows
  $("#containerLoading").collapse("hide");
  $("#containerUnregistered").collapse("show");
  // Pressing the 'About this project' link directs the user to the introductory webpage
  $("#buttonAboutProjectUnregistered").click(() => {
    getConfig().then((config) => { ext.tabs.create({ url: config.landingPage }); });
  });
  // Pressing the 'Register' link directs the user to the registration webpage
  $("#buttonRegisterPluginUnregistered").click(() => {
    getConfig().then((config) => { ext.tabs.create({ url: config.registerPage }); });
  });
}

/*
  This function initiates the popup window
*/
function init() {
  // Note: As the initiation involves an asynchronous process, the page defaults to a loading animation
  // If the user has a hash key...

  function intendedRoutine() {
    storage.get('hash_key', (this_hash_key_object)=>{
      getConfig().then((config) => { 
        const currentTime = moment().tz(moment.tz.guess());
        if (moment(config.startDate).isBefore(currentTime) && moment(config.endDate).isAfter(currentTime)) {
          if (this_hash_key_object.hash_key) {
            // Show the page intended for registered versions
            loadPageRegistered();
          } else {
            // Otherwise, show the page intended for unregistered versions
            if (CONST_OVERRIDE_REGISTRATION) {
              loadPageRegistered();
            } else {
              loadPageUnregistered();
            }
          }
        } else {
          loadPageFinished();
        }
      });
    });
  }

  // Bypass service worker for manifest version < 3
  if (CONST_MANIFEST_VERSION_INTEGER < 3) {
    intendedRoutine();
  } else {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('../background.js').then(function(registration) {
          // Registration was successful
          if (debugAO) { console.log('ServiceWorker registration successful with scope: ', registration.scope); }
          intendedRoutine();
        }, function(err) {
          // registration failed :(
          if (debugAO) { console.log('ServiceWorker registration failed: ', err); }
        });
      });
    }
  }
  
}

init();







