import storage from '../utils/utilitiesStorage';
import ext from '../utils/utilitiesCrossBrowser';
import { debugAO } from '../config';

const CONST_RECURSE_SCAN_ACTIVATION_CODE_INTERVAL_MILLISECONDS = 1000;
const CONST_TARGET_ELEMENT_ID = 'injectAustralianSearchExperiencePluginActivationCode';

/*
	This function checks the page for the div element that generates the hash key, and then returns it page to the plugin
	Note: As per the manifest.json file, this will run only the ADM+S Australian Search Experience registration page.
*/
function scanForActivationCode() {
	storage.get('hash_key', (this_hash_key_object)=>{
		// If the plugin does not have a hash key...
		if (!this_hash_key_object.hash_key) {
			// Recursively run the routine
			setTimeout(function() {
				if (debugAO) { console.log("Checking for activation code..."); }
				var targetDivElement = document.getElementById(CONST_TARGET_ELEMENT_ID);
				// If the target div element exists...
				if (targetDivElement !== null) {
					// Determine the activation code
					var candidateActivationCode = targetDivElement.innerHTML;
					// Evaluate that this isn't a failed event
					if ((candidateActivationCode.length > 0) && (candidateActivationCode != "failure")) {
						// Provided the routine was a success, set the activation code
						storage.set({'hash_key': candidateActivationCode },()=>{
							// Then run the first search process
							var port = ext.runtime.connect(ext.runtime.id);
							port.postMessage({ action: "provoke-initial-search-process" });
						});
					} 
				}
				scanForActivationCode();
			}, CONST_RECURSE_SCAN_ACTIVATION_CODE_INTERVAL_MILLISECONDS);
		}
	});
}

/*
	Ideally, we would like to have a service worker polling event on this content script, however it is unnecessary, as all routes to this script ensure that the service worker is awake
*/
scanForActivationCode();