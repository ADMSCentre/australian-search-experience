import ext from '../utils/utilitiesCrossBrowser';
import { CONST_WIPE_OVERRIDE, getConfig } from '../config';


// Note: Assuming the search routine is not in focus, all timed intervals will be roughly doubled
const CONST_SEND_RETRIEVED_HTML_BACK_ATTEMPT_1_MILLISECONDS = 2000;
const CONST_SEND_RETRIEVED_HTML_BACK_ATTEMPT_2_MILLISECONDS = 3000;
const CONST_SEND_RETRIEVED_HTML_BACK_ATTEMPT_3_MILLISECONDS = 4000;
var CONST_DELETE_WINDOW_ATTEMPT_1_MILLISECONDS = 6000;
var CONST_DELETE_WINDOW_ATTEMPT_2_MILLISECONDS = 30000;


// This code block only runs on pages that have the designated query parameter
if (window.location.href.indexOf('ase_injection_wipe=true') != -1) {

	// Initiate the long-lived connection with the extension

	/*
		This function retrieves the HTML of the page, and sends it back to the plugin
		Note: The function is set to run multiple times during page load, to anticipate as many changes to DOM content as possible
	*/
	function sendRetrievedHTML() {
		/*
		ext.runtime.sendMessage({
		    action: "catch-html",
		    body: document.documentElement.outerHTML
		});*/
		var port = ext.runtime.connect(ext.runtime.id);
		port.postMessage({
		    action: "catch-html",
		    body: document.documentElement.outerHTML
		});
	}

	/*
		This function strips the renderisation of all pages that have the query parameter "ase_injection_wipe"
	*/
	function addStyleObject() {
		if (!(CONST_WIPE_OVERRIDE)) {
			// If we're dealing with a page from Youtube, we have to retain a particular script
			if (window.location.href.indexOf('youtube.com/') != -1) {
				for (var i = 0; i < document.body.getElementsByTagName("*").length; i ++) {
					var thisElement = document.body.getElementsByTagName("*")[i];
					if (thisElement.outerHTML.indexOf("ytInitialData") == -1) {
						thisElement.parentNode.removeChild(thisElement);
					}
				}
			} else {
				// Otherwise, we remove a lot of chunky content from the page
				var styleObject = document.createElement('style');
				styleObject.type='text/css';
				styleObject.innerHTML = 'body { display: none !important; }';
				document.getElementsByTagName('head')[0].prepend(styleObject);
			}
		}
	}

	// This function recursively forces the search routine into its next step
	function recursivelyForceSearchRoutineStep() {
		setTimeout(function() { 
			var port = ext.runtime.connect(ext.runtime.id);
			port.postMessage({
			    action: "force-search-routine-step"
			});
			recursivelyForceSearchRoutineStep(); 
		}, CONST_DELETE_WINDOW_ATTEMPT_1_MILLISECONDS);
	}

	getConfig().then(config => {
		CONST_DELETE_WINDOW_ATTEMPT_1_MILLISECONDS = config.searchProcessInterval;

		// These fire on ALL 'load' events
		window.addEventListener('load', (event) => { addStyleObject(); sendRetrievedHTML(); });
		document.addEventListener('readystatechange', (event) => { addStyleObject(); });
		document.addEventListener('DOMContentLoaded', (event) => { addStyleObject(); sendRetrievedHTML(); });

		// These may or may not be called, depending on browser load speeds and reliability of the 'setTimeout' function
		setTimeout(function(){
			sendRetrievedHTML();
		}, CONST_SEND_RETRIEVED_HTML_BACK_ATTEMPT_1_MILLISECONDS);

		setTimeout(function(){
			sendRetrievedHTML();
		}, CONST_SEND_RETRIEVED_HTML_BACK_ATTEMPT_2_MILLISECONDS);

		setTimeout(function(){
			sendRetrievedHTML();
		}, CONST_SEND_RETRIEVED_HTML_BACK_ATTEMPT_3_MILLISECONDS);

		recursivelyForceSearchRoutineStep();
	});
}












