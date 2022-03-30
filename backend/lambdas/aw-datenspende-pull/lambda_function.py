'''

	This API has the sole purpose of retrieving data donations from the necessary table in DynamoDB. It works
	as a standalone function in order to monitor the exact amount of computation required to paginate the data donations
	table.
	
'''
import boto3
import simplejson as json

'''
	This function assists DynamoDB query expression construction
'''
def apply_key_condition_function(applyfirstExpression):
	addToExpression = ""
	if (not applyfirstExpression):
		addToExpression = " AND "
	return addToExpression

def lambda_handler(event, context):
	resultsToReturn = list()
	# Default to the current target table
	target_table = "aw-datenspende"
	# Set the target table if specified...
	if ('table' in event):
		target_table = event['table']
	'''
		Construct the necesssary DynamoDB query based on the provided parameters
	'''
	applyKeyConditionExpression = ""
	applyExpressionAttributeNames = dict()
	applyExpressionAttributeValues = dict()
	applyfirstExpression = True
	'''
		Static field logic
	'''
	staticFields = ['uuid', 'localisation', 'logged_in', 'plugin_id', 'time_of_retrieval', 
																'user_agent', 'version', 'platform']
	for static_field in staticFields:
		if (static_field in event):
			valueExact = event[static_field]
			addToExpression = apply_key_condition_function(applyfirstExpression)
			applyfirstExpression = False
			applyKeyConditionExpression += addToExpression + "#" + static_field[0:2] + " = :" + static_field[0:3]
			applyExpressionAttributeNames["#"+static_field[0:2]] = static_field
			if (static_field == "logged_in"):
				applyExpressionAttributeValues[":"+static_field[0:3]] = bool(int(valueExact))
			else:
				applyExpressionAttributeValues[":"+static_field[0:3]] = valueExact
	'''
		Time boundary logic
	'''
	if ("time_of_retrieval_exact" in event):
		addToExpression = apply_key_condition_function(applyfirstExpression)
		applyfirstExpression = False
		applyKeyConditionExpression += addToExpression+"#cA = :cAExact"
		applyExpressionAttributeNames["#cA"] = "time_of_retrieval"
		applyExpressionAttributeValues[":cAExact"] = int(event["time_of_retrieval_exact"])
	else:
		if ("time_of_retrieval_min" in event):
			addToExpression = apply_key_condition_function(applyfirstExpression)
			applyfirstExpression = False
			applyKeyConditionExpression += addToExpression+"#cA >= :cAMin"
			applyExpressionAttributeNames["#cA"] = "time_of_retrieval"
			applyExpressionAttributeValues[":cAMin"] = int(event["time_of_retrieval_min"])
		if ("time_of_retrieval_max" in event):
			addToExpression = apply_key_condition_function(applyfirstExpression)
			applyfirstExpression = False
			applyKeyConditionExpression += addToExpression+"#cA <= :cAMax"
			applyExpressionAttributeNames["#cA"] = "time_of_retrieval"
			applyExpressionAttributeValues[":cAMax"] = int(event["time_of_retrieval_max"])
	# Further query construction
	dbParams = {
		"TableName": target_table
	}
	if (len(applyExpressionAttributeNames.keys()) > 0):
		dbParams["FilterExpression"] = applyKeyConditionExpression
		dbParams["ExpressionAttributeNames"] = applyExpressionAttributeNames
		dbParams["ExpressionAttributeValues"] = applyExpressionAttributeValues
	# Execute the query
	table = boto3.resource("dynamodb").Table(target_table)
	response = table.scan(**dbParams)
	resultsToReturn = response['Items']
	# Pagination is required (as there may be more than 100 elements)
	while 'LastEvaluatedKey' in response:
		response = table.scan(**dbParams,ExclusiveStartKey=response['LastEvaluatedKey'])
		resultsToReturn.extend(response['Items'])
	return {
	'statusCode': 200,
	'body': json.dumps(resultsToReturn)
	}


