import ext from './utilitiesCrossBrowser';

// This file mediates storage across the different browsers
module.exports = (ext.storage.local ? ext.storage.local : ext.storage.sync);
