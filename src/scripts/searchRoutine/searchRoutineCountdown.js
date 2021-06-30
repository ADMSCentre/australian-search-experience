import ext from '../utils/utilitiesCrossBrowser';
import { debugAO } from '../config.js';
import Alarms from '../alarms.js'

var countDownValidated = true; // This variable enables the countdown to proceed
const CONST_COUNTDOWN_INTERVAL_MILLISECONDS_VALUE = 1000;
const CONST_COUNTDOWN_ORIGINAL_NUMBER_OF_MILLISECONDS = 10000; // This value is hard-coded to the CSS
const CONST_COUNTDOWN_ON_PAUSE_REMOVE_WINDOW_IN_MILLISECONDS = 3000;

// Note: This script assumes the management of the onCreated event listener in the Alarms module
// which filters countdown tabs that are not rightfully called.

/*
	This function enables the step of the countdown, and is synced with the
	countDownValidated variable to call the 'run-from-countdown' event once the countdown
	reaches zero.
*/
function countdownStep(arg_countdownSecondsValue) {
	// Depending on the recursion, set the countdown seconds value
	var countdownSecondsValue = arg_countdownSecondsValue || CONST_COUNTDOWN_ORIGINAL_NUMBER_OF_MILLISECONDS;
	// In one step of the interval time...
	setTimeout(function() {
		// If the countdown is validated...
		if (countDownValidated) {
			// Adjust the countdown value
			countdownSecondsValue -= CONST_COUNTDOWN_INTERVAL_MILLISECONDS_VALUE;
			// If we have reached zero...
			if (countdownSecondsValue == 0) {
				// Call the search process event
				var action  = 'run-from-countdown';
				ext.runtime.sendMessage({ action });
			} else {
				// Run another step of a second
				countdownStep(countdownSecondsValue);
			}
			// Adjust the frontfacing CSS simultaneously
			$("#center-count").html(countdownSecondsValue/CONST_COUNTDOWN_INTERVAL_MILLISECONDS_VALUE);
			$("#spinner-count").addClass("anim"+String(10-countdownSecondsValue/CONST_COUNTDOWN_INTERVAL_MILLISECONDS_VALUE));
			$("#filler-count").addClass("anim"+String(10-countdownSecondsValue/CONST_COUNTDOWN_INTERVAL_MILLISECONDS_VALUE));
			$("#mask-count").addClass("anim"+String(10-countdownSecondsValue/CONST_COUNTDOWN_INTERVAL_MILLISECONDS_VALUE));
		} else {
			if (debugAO) { console.log("The countdown has been invalidated...") }
		}
	},CONST_COUNTDOWN_INTERVAL_MILLISECONDS_VALUE);
}

// Call the countdown
countdownStep();

/* 
	This is the event listener for the countdown "Close" button
*/
document.getElementById("searchCloseWindowId").addEventListener("click", function() {
	if (debugAO) { console.log("Closing the window...") }
	Alarms.searchAlarmKillCountdownTab();
});

/*
	This is the event listener for the countdown "Pause" button
*/
document.getElementById("searchAlarmPauseId").addEventListener("click", function() {
	if (debugAO) { console.log("Force-pausing the search alarm...") }
	// Invalidate the countdown
	countDownValidated = false;
	// Force the alarm to pause
	Alarms.searchAlarmPauseToggle(true).then(()=>{
		// Then show the modal, and kill the coutdown tab
		$('#cc-modal').modal();
		setTimeout(()=> {
			Alarms.searchAlarmKillCountdownTab();
		}, CONST_COUNTDOWN_ON_PAUSE_REMOVE_WINDOW_IN_MILLISECONDS);
	});
});



