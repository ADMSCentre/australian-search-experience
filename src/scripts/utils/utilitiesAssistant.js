import randomId from 'random-id';
import storage from './utilitiesStorage';
import ext from './utilitiesCrossBrowser';
import moment from 'moment';
import { getConfig, debugAO } from '../config';

/*
  This function adds trailing zeros onto the countdown for pausing the plugin
*/
export function renderNormaliseClockValue(value) {
  return (String(value).length > 1) ? String(value) : '0'+String(value);
}

/*
  This function generates a timestamp value in UNIX format
*/
export function getTimeStamp() {
  const unixDate = moment.utc().unix();
  return unixDate;
}

/*
  This function generates a new ID
*/
export function makeId() {
  return randomId(32, "a0");
}

/*
  This function removes tabs safely, anticipating errors
*/
export function safelyRemoveTab(tabId) {
  try {
  	ext.tabs.remove(tabId, ()=>{
     if(ext.runtime.lastError) {}
    })
  } catch (e) {
    if (debugAO) { console.log(e); }
  }
}

/*
  This function removes windows safely, anticipating errors
*/
export function safelyRemoveWindow(windowId) {
  try {
    ext.windows.remove(windowId, ()=>{
     if(ext.runtime.lastError) {}
   })
  } catch (e) {
    if (debugAO) { console.log(e) }
  }
}

/*
  This function evaluates whether a tab exists before running any code on it
*/
export async function safelyExecuteOnTab(tabId) {
  return await new Promise((resolve, reject) => {
    if ((tabId !== undefined) && (tabId != null)) {
    	try {
    		ext.tabs.get(tabId, (tab) => {
	        if(!ext.runtime.lastError) {
	          resolve(true);
	        } else {
	          resolve(false);
	        }
	      })
    	} catch (e) {
    		resolve(false);
    		// An error occurs here when there is no tab of ID
    	}
    } else {
      resolve(false);
    }
  });
}

/*
  This function evaluates whether a window exists before running any code on it
*/
export async function safelyExecuteOnWindow(windowId) {
  return await new Promise((resolve, reject) => {
    if ((windowId !== undefined) && (windowId != null)) {
      try {
        ext.windows.get(windowId, (window) => {
          if(!ext.runtime.lastError) {
            resolve(true);
          } else {
            resolve(false);
          }
        })
      } catch (e) {
        resolve(false);
        // An error occurs here when there is no window of ID
      }
    } else {
      resolve(false);
    }
  });
}

/*
  This function decodes HTML entities - Due credit to https://stackoverflow.com/questions/44195322/a-plain-javascript-way-to-decode-html-entities-works-on-both-browsers-and-node
*/
function decodeEntities(encodedString) {
  var translate_re = /&(nbsp|amp|quot|lt|gt);/g;
  var translate = {
      "nbsp":" ",
      "amp" : "&",
      "quot": "\"",
      "lt"  : "<",
      "gt"  : ">"
  };
  return encodedString.replace(translate_re, function(match, entity) {
      return translate[entity];
  }).replace(/&#(\d+);/gi, function(match, numStr) {
      var num = parseInt(numStr, 10);
      return String.fromCharCode(num);
  });
}

/*
  This function applies unicode character unescaping to raw strings
*/
export function assistant_unicodeCharEscape(argString) {
  var hexes = argString.split("\\");
  var back = "";
  for(var j = 1; j<hexes.length; j++) {
     var xhex = hexes[j]
     var hex, remainder;
     var replacing = true;
     if ((xhex[0] == "n") || (xhex[0] == "r") || (xhex[0] == "t") || (xhex[0] == "b") || (xhex[0] == "f") || (xhex[0] == "v") || (xhex[0] == "0"))   {
        replacing = false;
        remainder = xhex;
     } else if (xhex[0] == "x") {
        hex = xhex.slice(1).substring(0,2);
        remainder = xhex.slice(3);
     } else if (xhex[0] == "u") {
        hex = xhex.slice(1).substring(0,4);
        remainder = xhex.slice(5);
     } else if ((xhex[0] == "/") || (xhex.length == 0)) {
        replacing = false;
        remainder = xhex;
     }
     if (replacing) {
        back += String.fromCharCode(parseInt(hex, 16)) + remainder;
     } else {
        back += remainder;
     }
     
  }
  return decodeEntities(hexes[0]+back);
}

/*
  This function converts fuzzy time (e.g. "1 day ago") to unix time
  Handles 29.03.2020 | 29/03/2020 | Dec 21 | X units ago | Yesterday | Feb 21 2020 | Streamed 1 day ago
*/
export function assistant_fuzzyTime(inputTextPre) {
  var inputText = inputTextPre
  
  var attemptedDate = null;
  // If there is no textual data hanging around
  if ((inputTextPre.match(/[a-zA-Z]+/gm) == null) || (inputTextPre.match(/[a-zA-Z]+/gm).join("").length < 3)) {
    // Attempt to process as a legitimate date
    try {
      attemptedDate = new Date(inputText);  // Attempting straight date conversion
      if ((attemptedDate == "Invalid Date") && (inputText.length > 10)) {
        attemptedDate = new Date(parseInt(inputText));  // Attempting integer parse
      }
      if ((attemptedDate == "Invalid Date") && (inputText.length <= 10)) {
        attemptedDate = new Date(parseInt(inputText)*1000); // Attempting integer parse with milliseconds
      }
    } catch (e) {}
  }
  if ((String(attemptedDate) != "Invalid Date") && (attemptedDate != null)) {
    return String(attemptedDate.toISOString().slice(0, 19).replace('T', ' '));
  } else {
    try {
      inputText = inputText.replaceAll("Streamed ","");
      inputText = inputText.replaceAll("Updated ","");
      const regexNumeral = /^.*?(?= )/gm;
      const regexUnit = /(?<= ).*?(?= )/gm;
      if (inputText.indexOf("Yesterday") != -1) {
        // Dealing with yesterday
        var today = new Date();
        today.setDate(today.getDate() - 1);
        return String(today.toISOString().slice(0, 19).replace('T', ' '));
      } else if (inputText.indexOf("ago") == -1) {
          // Dealing with a raw date
          try {
            var month = inputText.match(/[a-zA-Z]+/gm)[0].toLowerCase()
            var day = parseInt(inputText.match(/[0-9]+/gm)[0])
            var month_alt = null;
            if (inputText.match(/[0-9]+/gm).length > 1) {
              month_alt = parseInt(inputText.match(/[0-9]+/gm)[1]);
            }
            var yearList = inputText.match(/[0-9]{4}/gm)
            var appendMonth = 0;
            var months = {
              "jan" : 1,
              "feb" : 2,
              "mar" : 3,
              "apr" : 4,
              "may" : 5,
              "jun" : 6,
              "jul" : 7,
              "aug" : 8,
              "sep" : 9,
              "sept" : 9,
              "oct" : 10,
              "nov" : 11,
              "dec" : 12,
              "january" : 1,
              "february" : 2,
              "march" : 3,
              "april" : 4,
              "june" : 6,
              "july" : 7,
              "august" : 8,
              "september" : 9,
              "october" : 10,
              "november" : 11,
              "december" : 12
             }
            if (Object.keys(months).indexOf(month) == -1) {
              appendMonth = month_alt;
            } else {
              appendMonth = months[month];
            }
           var today = new Date();
           var appendYear = today.getFullYear()
           if ((yearList == null) || (yearList.length == 0)) {
             if (months[month] > today.getMonth()) {
              appendYear --;
             }
           } else {
             appendYear = parseInt(yearList[0]);
           }
           var recordedDate = new Date(String(appendMonth)+" "+String(day)+" "+appendYear);
           return String(recordedDate.toISOString().slice(0, 19).replace('T', ' '));
         } catch (e) {
            error_log.push(String(e)+" "+String(e.lineNumber)+" ");;
          if (debugAO) { console.log(e); }
          return inputText;
        }
      } else {
        try {
          var numeral = parseInt(inputText.match(regexNumeral)[0].toLowerCase())
          var preprocessedUnit = inputText.match(regexUnit)[0].toLowerCase()
          var preprocessedUnitDeLemma;
          if (preprocessedUnit.slice(-1) === 's') {
            preprocessedUnitDeLemma = preprocessedUnit.slice(0, -1);
          } else {
            preprocessedUnitDeLemma = preprocessedUnit;
          }
          var processedUnit = {
            "sec" : 1, 
            "second" : 1, 
            "min" : 1*60, 
            "minute" : 1*60, 
            "hour" : 1*60*60, 
            "day" : 1*60*60*24, 
            "week" : 1*60*60*24*7, 
            "month" : 1*60*60*24*7*4, 
            "year" : 1*60*60*24*7*52 }[preprocessedUnitDeLemma]
          var epochtimeInSeconds = (Math.floor(Date.now() / 1000) - (numeral*processedUnit))
          return String(new Date(epochtimeInSeconds * 1000).toISOString().slice(0, 19).replace('T', ' '));
        } catch (e) {
         error_log.push(String(e)+" "+String(e.lineNumber)+" ");;
          if (debugAO) { console.log(e); }
          return inputText;
        }
      }
    } catch (e) {
      return null;
    }
  }
}

/*
  This function runs number conversions
*/
export function assistant_numberConversion(inputText) {
  var inputTextPreprocessed = inputText || null;
  var returnValue = null;
  try {
    // Replace all numerical commas
    inputTextPreprocessed = inputTextPreprocessed.replace(RegExp("(?<=[0-9]),(?=[0-9])","g","m"),"")
    // Retrieve all return values
    var alphabeticalReturns = ((inputTextPreprocessed.match(RegExp("[a-zA-Z]+", "g", "m")))||[]).map((x)=>{return x.toLowerCase()});
    var alphabeticalTrailerReturns = ((inputTextPreprocessed.match(RegExp("(?<=[0-9]+)[a-zA-Z]+", "g", "m")))||[]).map((x)=>{return x.toLowerCase()});
    var numericalReturns = ((inputTextPreprocessed.match(RegExp("[0-9.]+", "g", "m")))||[]);
    returnValue = parseFloat(numericalReturns[0]);
    // Whole words are prioritised
    var multiplicant = 1;
    if (alphabeticalReturns.indexOf("trillion") != -1) {
      multiplicant = 10**12;
    } else 
    if (alphabeticalReturns.indexOf("billion") != -1) {
      multiplicant = 10**9;
    } else 
    if (alphabeticalReturns.indexOf("million") != -1) {
      multiplicant = 10**6;
    } else 
    if (alphabeticalReturns.indexOf("thousand") != -1) {
      multiplicant = 10**3;
    } else
    if (alphabeticalTrailerReturns.indexOf("t") != -1) {
      multiplicant = 10**12;
    } else
    if (alphabeticalTrailerReturns.indexOf("b") != -1) {
      multiplicant = 10**9;
    } else
    if (alphabeticalTrailerReturns.indexOf("m") != -1) {
      multiplicant = 10**6;
    } else
    if (alphabeticalTrailerReturns.indexOf("k") != -1) {
      multiplicant = 10**3;
    }

    returnValue *= multiplicant;

  } catch (e) {
    if (debugAO) { console.log("Error at 'assistant_numberConversion':", e); }
  }
  return returnValue;
}

/*
  This function converts strings that communicate the views on an element into an integer
*/
export function assistant_fuzzyViews(inputText) {
  var outputViews = null;
  try {
    // Remove the word 'views', which we anticipate
    var inputTextProcessed = inputText;

    inputTextProcessed = inputTextProcessed.replaceAll("views", "");
    // Run the number conversion
    outputViews = parseInt(assistant_numberConversion(inputTextProcessed).toFixed(2));
    // Then run a simple number conversion
  } catch (e) {
    if (debugAO) { console.log("Error at 'assistant_fuzzyViews':", e); }
  }
  return outputViews;
}

/*
  This function is specialised for URL cleaning on Youtube image thumbnails
*/
export function assistant_youtubeURLClean(inputText) {
  try {
    if (inputText.substring(0,2) == '//') {
      return inputText.slice(2); // Remove the first two characters from the string
    } else {
      return inputText;
    }
    
  } catch (e) {
    return inputText;
  }
}

/*
  This function converts strings that communicate durations to integer values in seconds
*/
export function assistant_fuzzyDurationToSeconds(inputText) {
  if (inputText == "LIVE") {
    // Bypass LIVE streams
    return null;
  } else {
    var seconds = 0;
    try {
      var splitText = inputText.split(":");
      if (splitText.length == 1) {
        seconds += parseInt(splitText[0]);
      } else if (splitText.length == 2) {
        seconds += parseInt(splitText[0])*60;
        seconds += parseInt(splitText[1]);
      } else if (splitText.length == 3) {
        seconds += parseInt(splitText[0])*60*60;
        seconds += parseInt(splitText[1])*60;
        seconds += parseInt(splitText[2]);
      }
    } catch (e) {
       error_log.push(String(e)+" "+String(e.lineNumber)+" ");;
      if (debugAO) { console.log(e); }
      // Do Nothing
    }
    return seconds;
  }
}

/*
  This function runs index-checking
*/
export function assistant_Indexed(inputText) {
  return (inputText != null);
}

/*
  This function strips the text of HTML tags
*/
export function assistant_stripHTMLTags(inputText) {
  var outputText = inputText;
  outputText = outputText.replace(RegExp("<[^>]*>?","g","m"), "");
  return outputText;
}

/*
  This function produces a dynamic HTML object
*/
export function assistant_dynamicHTML(inputText) {
  try {
    var tagList = inputText.match(/<.*?>/gm).map((x)=>{
      var y = x.match(/<(\/[a-z-]+|[a-z-]+)/gm)[0];
      var additive = '';

      if (x.indexOf(" src=") != -1) {
          additive += " src";
      }

      if (x.indexOf(" href=") != -1) {
          additive += " href";
      }

      if (('<div'.indexOf(y) == -1) && ('</div'.indexOf(y) == -1)) { return `${y}${additive}>`;} else { return ''; } 
    });

    var wipedHTML = inputText.replace(/<.*>/gm,'')
    return inputText.replace(/<.*?>/gm, (x)=>{return tagList.shift();});
  } catch (e) {
    return null;
  }
}

/*
  This function applies assistant functions to the rendered result
*/
export function applyAssistantFunction(condition, application, arg_value) {
  var set_value = arg_value;
  if (condition) {
    if (set_value == null) {
      // The null value is sometimes required for the 'INDEX' flag
      set_value = application(set_value);
    } else
    if (set_value.constructor != String) {
      // We are dealing with a list
      for (var i = 0; i < set_value.length; i ++) {
        set_value[i] = application(set_value[i]);
      }
    } else {
      set_value = application(set_value);
    }
  }
  return set_value;
}

/*
  This function de-slashes an escaped string
*/
export function assistant_deSlash(inputText) {
  return inputText.replaceAll(`\\`,``);
}

/*
  These functions implement the standard behaviour for flag detection in expressions that need to be evaluated 
*/
export function customFlagStandardBehaviourPositive(expressionsToEvaluate, flag) { return expressionsToEvaluate.replaceAll(`[FLAG_${flag}]`,""); }
export function customFlagStandardBehaviourNegative(expressionsToEvaluate, flag) { return expressionsToEvaluate; }

/*
  These functions implement the behaviour of a 'recursive' flag in expressions that need to be evaluated 
*/
export function customFlagBehaviourRecursePositive(expressionsToEvaluate, flag) { return expressionsToEvaluate.split(`[FLAG_${flag}]`); }
export function customFlagBehaviourRecurseNegative(expressionsToEvaluate, flag) { return [expressionsToEvaluate]; }




