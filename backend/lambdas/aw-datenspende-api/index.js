// To install a new package (e.g. "querystring"), jump up the directory tree and implement: npm install --prefix api querystring

//https://65i9k6fick.execute-api.us-east-2.amazonaws.com/aw-datenspende-api

const AWS = require('aws-sdk');
const querystring = require('querystring');
const uuid = require('uuid');
const s3 = new AWS.S3();
const awDatenspendeBucketName = "aw-datenspende-bucket";
const awDatenspendeTable = "aw-datenspende";
const awDatenspendeUsersTable = "aw-datenspende-users";
const awDatenspendeIPCacheTable = "aw-datenspende-ip-cache";

const dynamoDB = new AWS.DynamoDB.DocumentClient();
var ddb = new AWS.DynamoDB();
/*
	The threshold settings for the number of user requests that can push data to the API within some
	given interval
*/
const CONST_THROTTLE_INTERVAL = 60*5;
const CONST_THROTTLE_MAX_USERS = 3;

/*
	This shorthand function assists with constructing expressions in DynamoDB
*/
function applyKeyConditionFunction(applyfirstExpression) {
	var addToExpression = "";
	if (!applyfirstExpression) {
		addToExpression = " AND ";
	}
	return [addToExpression, false];
}


async function IP_log_then(event, post_function) {
	// Add the user's IP to the IP table
	return await dynamoDB.put({ 
		"TableName": awDatenspendeIPCacheTable, 
		"Item": { 
			"uuid": uuid.v1(),
			"createdAt" : parseInt(Date.now()/1000),
			"sourceIp" : event.requestContext.http.sourceIp
		}
	}).promise().then(async function(data, err){
		return await post_function();
	});
}
/*
	This function throttles requests to the API, so that we don't get bombarded by anyone attempting to
	overload our server.
*/
async function IP_check_gate(event,post_function) {
	var params = {
		TableName : awDatenspendeIPCacheTable,
		ProjectionExpression : "#ip, #ca",
		FilterExpression : '#ip = :ip',
		ExpressionAttributeNames : {"#ip" : "sourceIp", "#ca" : "createdAt"},
		ExpressionAttributeValues : {":ip" : String(event.requestContext.http.sourceIp)}
	}
	// Determine if the source IP of the API call has been unnaturally pushing a lot of data to the server
	return await dynamoDB.scan(params).promise().then(async function(data){
		const current_time = parseInt(Date.now()/1000);
		// We only evaluate the first 100 results (maximum of 100 requests on a single IP throttle)
		var users_in_interval = 0;
	    data.Items.forEach(function(item) {
	    	if (Math.abs(parseInt(item.createdAt)-current_time) <= CONST_THROTTLE_INTERVAL) {
	    		users_in_interval += 1;
	    	}
	    });
	    // We have a threshold of the number of requests that can be generated on a single IP address
	    if (users_in_interval >= CONST_THROTTLE_MAX_USERS) {
			var response = { statusCode: 200 };
	    	response.body = JSON.stringify({
	    		status : "failure_throttle"
	    	});
	    	return response;
	    } else {
	    	return await post_function();
	    }
	});
}

/*
	Main handler of AWS Lambda API (i.e. entrypoint)
*/
exports.handler = async (event) => {

	// Prepare the response (and allow CORS)
	var response = { 
			statusCode: 200, 
			headers: {
	            "Access-Control-Allow-Headers" : "*",
	            "Access-Control-Allow-Origin": "*",
	            "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
	        } 
	    };

	/*
		All events for the API work on POST protocols, except the event responsible for paginating data when
		pushing it to the Google BigQuery infrastructure.
	*/
	if (event.requestContext.http.method == 'POST') {

		try {

			var entryUUID = uuid.v1();
		    var eventBodyParsed = JSON.parse(event.body);

		    /*
				Data donation event - Whenever a 'citizen scientist' submits a data donation to our server, this event
				stores the data within the nominated table in DynamoDB
		    */
		    if (eventBodyParsed.event == "collection") {

		    	// Assume success prior to any 'try-catch's
		    	response.body = JSON.stringify('Collected successfully.');

		    	// Attempt to add the data to the necessary table within DynamoDB
		    	try {
		    		var oneWeekInSeconds = 604800;
			    	dynamoDB.put({ 
			    		"TableName": awDatenspendeTable, 
			    		"Item": { 
			    			"uuid": entryUUID, 
			    			"localisation" : eventBodyParsed.localisation,
			    			"logged_in" : Boolean(eventBodyParsed.logged_in),
			    			"platform" : eventBodyParsed.platform,
			    			"plugin_id" : eventBodyParsed.plugin_id,
			    			"time_of_retrieval" : parseInt(eventBodyParsed.time_of_retrieval),
			    			"TTL" : parseInt(eventBodyParsed.time_of_retrieval)+oneWeekInSeconds,
			    			"user_agent" : eventBodyParsed.user_agent,
			    			"hash_key" : eventBodyParsed.hash_key, 
			    			"version" : eventBodyParsed.version
			    	}}).promise();
				} catch (error) {
			        response.body = JSON.stringify(error);
			    }

			    // Upload the payload's raw event body to the destination bucket for further examination if necessary
			    try {
			    	putResult = await s3.putObject({
			            Bucket: awDatenspendeBucketName,
			            Key: entryUUID,
			            Body: JSON.stringify(eventBodyParsed),
			            ContentType: "json"
			        }).promise(); 
			    } catch (error) {
			        response.body = JSON.stringify(error);
			    }

			    return response;

			/*
				User registration event - this event adds a new user's demographic details to the necessary table in DynamoDB
			*/
		    } else if (eventBodyParsed.event == "register_user") {

				/*
					This function undertakes the creation of the user's data within the necessary table of DynamoDB
				*/
				async function createUser() {
					
					// We begin by creating an associated UUID that is common for identification within AWS S3 and DynamoDB
					var this_UUID = uuid.v1();
					var this_hash = (function (){var a=[];for(var i=1;i<=8;i++){a.push(Math.random().toString(36).substr(2,4))}return a.join('');}).call();
					const current_time = parseInt(Date.now()/1000);
					
					// We then add the user's de-identified details to the user table
					return await dynamoDB.put({ 
						"TableName": awDatenspendeUsersTable, 
			    		"Item": { 
			    			"uuid": this_UUID,
			    			"hashKey" : String(this_hash),
			    			"createdAt" : current_time
			    		}
			    	}).promise().then(async function(data, err){
			    		if (err) {
			    			response.body = JSON.stringify({
				        		status : "failure"
				        	});
			    			return response;
			    		} else {
			    			// Add the user's IP to the IP table (for throttling if necessary)
							return await IP_log_then(event, async function () {
								// And add the raw data to S3 containing the demographic details of the individual
							    return await s3.putObject({
						            Bucket: awDatenspendeBucketName,
						            Key: this_UUID,
						            Body: JSON.stringify(eventBodyParsed.data),
						            ContentType: "json"
						        }).promise().then(async function(data,err){
						        	if (err) {
						    			response.body = JSON.stringify({
							        		status : "failure"
							        	});
						    			return response;
						    		} else {
						    			// Return the hash key for local storage
						    			response.body = JSON.stringify({
							        		status : "success",
							        		hash_key : String(this_hash)
							        	});
							        	return response;
						    		}
						        });
							});
			    		}
			    	});
				}
				
				// Execute the creation of the user
				return await IP_check_gate(event, async function (data) { 
					return await createUser();
				});

			/*
				Table details retrieval event - This event retrieves the immediate table details for the DynamoDB table containing the data donations -
				typically, we'd use this information for hit-counters on the registration site.
			*/
			} else if (eventBodyParsed.event == "get_table_details") {
				// If we pass the IP check gate...
				return await IP_check_gate(event, async function () { 
					return await IP_log_then(event, async function () {
						// Attempt to describe the table containing all data donations
						return await ddb.describeTable({TableName:awDatenspendeTable}).promise().then(async function(dataAWDatenspendeTable){
							return await ddb.describeTable({TableName:awDatenspendeUsersTable}).promise().then(async function(dataAWDatenspendeUsersTable){
								// Push the details in JSON format to the S3 bucket
								return await s3.putObject({
						            Bucket: awDatenspendeBucketName,
						            Key: "user_stats.json",
						            ACL:'public-read',
						            Body: JSON.stringify({
						        		status : 200,
						        		last_updated: String(parseInt(Date.now()/1000)),
						        		number_of_users: dataAWDatenspendeUsersTable['Table']['ItemCount'],
						        		number_of_scrapes: (dataAWDatenspendeTable['Table']['ItemCount']*150)
						        	}),
						            ContentType: "json"
						        }).promise().then(function() {
						        	return JSON.stringify({
						        		status : 200,
						        		number_of_users: dataAWDatenspendeUsersTable['Table']['ItemCount'],
						        		number_of_scrapes: (dataAWDatenspendeTable['Table']['ItemCount']*150)
						        	});
						        });
							});
						});
					});
				});
			
			/*
				User verification event - This event checks if a user has verified their plugin with the necessary table of 
				DynamoDB, and is necessary to complete installation of the plugin
			*/
			} else if (eventBodyParsed.event == "check_verified") {

				// If we pass the IP check gate...
				return await IP_check_gate(event, async function () { 
					return await IP_log_then(event, async function () {
						// And the request is well-formed...
						if (("key" in eventBodyParsed) && (eventBodyParsed.key)) {
							// Determine if the hash key is within the user details table of DynamoDB
							return await dynamoDB.scan({
									TableName : awDatenspendeUsersTable,
									ProjectionExpression : "#ha",
									FilterExpression : '#ha = :ha',
									ExpressionAttributeNames : {"#ha" : "hashKey"},
									ExpressionAttributeValues : {":ha" : eventBodyParsed.key}
								}).promise().then(async function(data){

								// We only evaluate the first 100 results (maximum of 100 requests on a single IP throttle)
								var hash_exists = false;
						        data.Items.forEach(function(item) {
						        	hash_exists = true;
						        });
								return JSON.stringify({
					        		status : 200,
					        		status_verified: hash_exists
					        	});
							});
						} else {
							return JSON.stringify({
				        		status : 200,
				        		status_verified: false
				        	});
						}
						
					});
				});

			/*
				Get users event - This function retrieves all users from the responsible DynamoDB table
			*/
		    } else if (eventBodyParsed.event == "get_users") {
		    	var resultsToReturn = [];

		    	/*
					This function handles the pagination of the request
		    	*/
				async function scanReturn(params) {
					return await dynamoDB.scan(params).promise().then( async function(data) {
				        data.Items.forEach(function(itemdata) {
				        	resultsToReturn.push(itemdata);
				        });
				        // Continue scanning if we have more items...
				        if (typeof data.LastEvaluatedKey != "undefined") {
				            params.ExclusiveStartKey = data.LastEvaluatedKey;
				            return await scanReturn(params);
				        } else {
				        	return data;
				        }
					});
				}

				// Execute the query
				var thisParams = { "TableName": awDatenspendeUsersTable }
				if ("afterDate" in eventBodyParsed) {
					thisParams["FilterExpression"] = "#t BETWEEN :t AND :u";
					thisParams["ExpressionAttributeNames"] = { "#t" : "createdAt" };
					thisParams["ExpressionAttributeValues"] = { 
						":t" : eventBodyParsed.afterDate,
						":u" : eventBodyParsed.afterDate+(60*60) };
				}
				return await scanReturn(thisParams);

		    } else {
		    	response.body = JSON.stringify({
	        		status : "failure"
	        	});
		    	return response;
		    } 

		} catch (err) {
	        response.body = JSON.stringify({
	        	status : "error",
	        	message: err.message, 
	        	stack: err.stack 
	        });
	        return response;
	    }

	/*
		The GET protocol has one single function: given a set of metadata parameters, receive the corresponding data donations
		from the necessary table within DynamoDB

		Note: This functionality is depreciated, and was only implemented during the BETA phase of software development. DO
		NOT restore it as it compromises several security measures in place.
	*/
    } else
    if (event.requestContext.http.method == 'GET') {
    	/*
    	var awDatenspendeTableTarget = awDatenspendeTable;
    	var queryParams = querystring.parse(event.rawQueryString);

    	if ('table' in queryParams) {
    		awDatenspendeTableTarget = queryParams.table;
    	}
    	
    	var applyKeyConditionExpression = "";
    	var applyExpressionAttributeNames = {};
    	var applyExpressionAttributeValues = {};
    	var applyfirstExpression = true;
    	var staticFields = ['uuid', 'localisation', 'logged_in', 'plugin_id', 'time_of_retrieval', 'user_agent', 'version', 'platform'];
    	for (var i = 0; i < staticFields.length; i ++) {
    		var valueName = staticFields[i];
    		var valueExact = queryParams[valueName] ? queryParams[valueName] : -1;
	    	if (valueExact != -1) {
	    		var [addToExpression, applyfirstExpression] = applyKeyConditionFunction(applyfirstExpression);
	    		applyKeyConditionExpression += addToExpression+"#"+valueName.slice(0,2)+" = :"+valueName.slice(0,3);
	    		applyExpressionAttributeNames["#"+valueName.slice(0,2)] = valueName;

	    		if (valueName == "logged_in") {
					applyExpressionAttributeValues[":"+valueName.slice(0,3)] = Boolean(parseInt(valueExact));
	    		} else {
	    			applyExpressionAttributeValues[":"+valueName.slice(0,3)] = valueExact;
	    		}
	    	}
    	}

    	

    	var time_of_retrieval_min = queryParams.time_of_retrieval_min ? parseInt(queryParams.time_of_retrieval_min) : -1;
    	var time_of_retrieval_max = queryParams.time_of_retrieval_max ? parseInt(queryParams.time_of_retrieval_max) : -1;
    	var time_of_retrieval_exact = queryParams.time_of_retrieval_exact ? parseInt(queryParams.time_of_retrieval_exact) : -1;
    	if (time_of_retrieval_exact != -1) {
    		var [addToExpression, applyfirstExpression] = applyKeyConditionFunction(applyfirstExpression);
    		applyKeyConditionExpression += addToExpression+"#cA = :cAExact";
    		applyExpressionAttributeNames["#cA"] = "time_of_retrieval";
    		applyExpressionAttributeValues[":cAExact"] = time_of_retrieval_exact;
    	} else {
    		if (time_of_retrieval_min != -1) {
	    		var [addToExpression, applyfirstExpression] = applyKeyConditionFunction(applyfirstExpression);
	    		applyKeyConditionExpression += addToExpression+"#cA >= :cAMin";
	    		applyExpressionAttributeNames["#cA"] = "time_of_retrieval";
	    		applyExpressionAttributeValues[":cAMin"] = time_of_retrieval_min;
	    	}
	    	if (time_of_retrieval_max != -1) {
	    		var [addToExpression, applyfirstExpression] = applyKeyConditionFunction(applyfirstExpression);
	    		applyKeyConditionExpression += addToExpression+"#cA <= :cAMax";
	    		applyExpressionAttributeNames["#cA"] = "time_of_retrieval";
	    		applyExpressionAttributeValues[":cAMax"] = time_of_retrieval_max;
	    	}
    	}

    	

    	var dbParams = {
			"TableName": awDatenspendeTableTarget
		}

		if (Object.keys(applyExpressionAttributeNames).length > 0) {
			dbParams["FilterExpression"] = applyKeyConditionExpression;
			dbParams["ExpressionAttributeNames"] = applyExpressionAttributeNames;
			dbParams["ExpressionAttributeValues"] = applyExpressionAttributeValues;
		}

		


		var resultsToReturn = [];

		async function scanReturn(params) {
			return await dynamoDB.scan(params).promise().then( async function(data) {
		        data.Items.forEach(function(itemdata) {
		        	resultsToReturn.push(itemdata);
		        });

		        if (typeof data.LastEvaluatedKey != "undefined") {
		            params.ExclusiveStartKey = data.LastEvaluatedKey;
		            return await scanReturn(params);
		        } else {
		        	return resultsToReturn;
		        }
			});
		}
		return await scanReturn(dbParams);
		*/

		return response;

	} else {
		return "You are on a bad IP address"
	}
};

