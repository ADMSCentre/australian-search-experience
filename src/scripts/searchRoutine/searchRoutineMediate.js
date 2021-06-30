import ext from '../utils/utilitiesCrossBrowser';

// This action mediates the search process to ensure that the page has been invoked correctly
var action  = 'mediate-search-routine';
ext.runtime.sendMessage({ action });