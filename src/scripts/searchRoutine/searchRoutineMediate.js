import ext from '../utils/utilitiesCrossBrowser';
import { debugAO, CONST_MANIFEST_VERSION_INTEGER } from '../config';

// This action mediates the search process to ensure that the page has been invoked correctly
var port = ext.runtime.connect(ext.runtime.id);
port.postMessage({ action: "mediate-search-routine" });

// This function recursively polls the service worker while the search process is taking place
function recursivelyRegisterServiceWorker() {
	// Attempt to register the service worker (if it is not already registered)
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('../background.js').then(function(registration) {
			// Registration was successful
			if (debugAO) { console.log('ServiceWorker registration successful with scope: ', registration.scope); }
		}, function(err) {
			// registration failed :(
			if (debugAO) { console.log('ServiceWorker registration failed: ', err); }
		});
	}
	setTimeout(function() { recursivelyRegisterServiceWorker(); }, 10000);
}

// Implement service worker for manifest version >= 3
if (CONST_MANIFEST_VERSION_INTEGER >= 3) {
	recursivelyRegisterServiceWorker();
}