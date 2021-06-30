import storage from '../utils/utilitiesStorage';

/*
	This function injects the details about the plugin into the registration page
*/
function addVariableInjectionASE() {
	if (document.getElementById("injectAustralianSearchExperiencePluginInstalled") !== null) {
		// The plugin is installed (obviously if this is running)
		document.getElementById("injectAustralianSearchExperiencePluginInstalled").innerHTML = "installed";
	}
	if (document.getElementById("injectAustralianSearchExperiencePluginStatus") !== null) {
		storage.get('hash_key', (this_hash_key_object)=>{
		  if (this_hash_key_object.hash_key) {
		  	// If we have a hash key, then the plugin is validated
		    document.getElementById("injectAustralianSearchExperiencePluginStatus").innerHTML = "installed-validated";
		  } else {
		  	// Otherwise, the plugin is not yet validated
			document.getElementById("injectAustralianSearchExperiencePluginStatus").innerHTML = "installed-not-validated";
		  }
		}); 
	}	
}

// The forementioned function runs on ALL load events
window.addEventListener('load', (event) => { addVariableInjectionASE(); });
document.addEventListener('readystatechange', (event) => { addVariableInjectionASE(); });
document.addEventListener('DOMContentLoaded', (event) => { addVariableInjectionASE(); });


