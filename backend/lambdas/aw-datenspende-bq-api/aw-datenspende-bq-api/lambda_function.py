'''

	This API corresponds to the AWS Lambda function that regularly pushes data from S3 to BigQuery.
	It is one of two major files, the other being the "run.py" file in the "bigquery" folder. 
	
'''
from run import *

import traceback
import botocore
import uuid

CONST_REJECTION_THRESHOLD = 0.05
CONST_12_HOURS_IN_SECONDS = (12*60*60)

'''
	This function sanitises JSON with respect to a given BQ schema
'''
def sanitise_json(json_root_fname, raw_json_list, schemas, threshold):
	s3_data_structure = {}
	s3_statistics = {}
	total_failures = 0
	total_successes = 0
	# For a list of JSON rows (coming from S3)
	for raw_json_element in raw_json_list:
		# Check first if the s3 data structure has the table in question...
		if (not raw_json_element["mode"] in s3_data_structure):
			s3_data_structure[raw_json_element["mode"]] = []
			s3_statistics["schema_%s_total_elements_n" % (raw_json_element["mode"])] = 0
			s3_statistics["schema_%s_failed_elements_n" % (raw_json_element["mode"])] = 0
			s3_statistics["schema_%s_succeeded_elements_n" % (raw_json_element["mode"])] = 0
		s3_statistics["schema_%s_total_elements_n" % (raw_json_element["mode"])] += 1
		# The row should be evaluated against the schema, and we log the results
		evaluation = evaluate_row_against_schema(json.dumps(raw_json_element["json"]), schemas["schema_%s.json" % (raw_json_element["mode"])]) # Currently dumping and reloading JSON, need to fix this
		if (evaluation["passed"]):
		   s3_data_structure[raw_json_element["mode"]].append(raw_json_element["json"])
		   s3_statistics["schema_%s_succeeded_elements_n" % (raw_json_element["mode"])] += 1
		   total_successes += 1
		else:
			s3_statistics["schema_%s_failed_elements_n" % (raw_json_element["mode"])] += 1
			total_failures += 1
	# We then push the sanitised rows back up to S3
	for k,v in s3_data_structure.items():
		boto3.resource('s3').Object("aw-datenspende-bq-bucket", "%s_%s_sanitised" % (json_root_fname, k)).put(Body=json.dumps(v))
	return_threshold_verdict = False
	if (total_successes > 0):
		return_threshold_verdict = ((total_failures/(total_successes+total_failures)) <= threshold)
	return s3_statistics, s3_data_structure, return_threshold_verdict

'''
	In order to assemble data for S3, we need to grab it from the AWS AW Datenspende API
'''
def request_to_json(platform, min_t=None, max_t=None):
	# We retrieve the data
	table_selection = None
	if ((max_t > 0) and (max_t < 1629421261)): # We drop Aug20 as the cut-line between the last database backup, and the current version
		table_selection = "aw-datenspende-1-Jan-2021-to-25-Aug-2021"
	if ((max_t >= 1629421261) and (max_t < 1632575315)): # We drop Aug20 as the cut-line between the last database backup, and the current version
		table_selection = "aw-datenspende-25-Aug-2021-to-25-Sep-2021"
	elif ((max_t >= 1632575315) and (max_t < 9000000000)):
		table_selection = "aw-datenspende"
	else:
		table_selection = "aw-datenspende"
	items = requests.get(CONSTANT_API_ENDPOINT, params={ "time_of_retrieval_min" : min_t, "time_of_retrieval_max" : max_t, "platform" : platform }).json()
	cfg = botocore.config.Config(retries={'max_attempts': 0}, read_timeout=840, connect_timeout=600, region_name="us-east-2")
	lambda_client = boto3.client("lambda", config=cfg)
	response = lambda_client.invoke(
		FunctionName = "arn:aws:lambda:us-east-2:519969025508:function:aw-datenspende-pull",
		InvocationType = "RequestResponse",
		Payload = json.dumps({ 
			"platform" : platform,
			"time_of_retrieval_min" : min_t,
			"time_of_retrieval_max" : max_t,
			"table" : table_selection
		}))
	responseFromChild = json.load(response["Payload"])
	items = json.loads(responseFromChild["body"])

	print("There are %s items to download" % (len(items)))
	# Then for each record, return the data from the corresponding file on S3
	items_compiled = []
	for item in items:
		response = request_to_json_subprocess(item['uuid'])
		if (response != None) and (type(response) == list):
			items_compiled.extend(response)
	return items_compiled

'''
	This function grabs the data for a record from S3
'''
def request_to_json_subprocess(key):
	try:
		response = requests.get(s3.generate_presigned_url('get_object', 
			Params={'Bucket': CONSTANT_S3_BUCKET_NAME, 'Key': key}, ExpiresIn=60), timeout=10).json()
		return route_json_construction(response, True)
	except Exception as e:
		print(e)
		print("Error encountered while attempting to grab UUID: %s" % (key))
'''
	This function works by specification of a platform and a "ticker value" (ticker_val)
	- which is essentially a value used to filter a given time range.
	The function will construct the BQ JSON data directly from the cohort's supplied data,
	and will sanitise it in cohesion with the schema that BQ accepts. Once sanitised, the
	function will push all data to BQ, and will provide statistics to BQ on the elements
	that successfully transfered, as well as those that didn't. In case of errors, the function
	will spin itself back up for a few more attempts. It is expected that this function is called
	sequentially, from AWS EventBridge, or as a one-off when loading an arbitrary time range.

'''
def lambda_handler(event, context):
	billed_duration = time.time()
	time_seed = int(time.time())-CONST_12_HOURS_IN_SECONDS # The seed time is 12 hours from the current time
	scan_kwargs = {
			'FilterExpression': '#platform = :platform',
			'ExpressionAttributeNames': {"#platform" : "platform"},
			'ExpressionAttributeValues' : {":platform" : event["platform"]}
		}
	# Instantiate the mode if it does not exist
	if (not "mode" in event):
		event["mode"] = "sequence"

	# In the instance of user append, the code block is different
	if (event["mode"] == "user_append"):
		# { "mode" : "user_append", "platform":"user" }
		# We attempt first to grab the ticker_val
		dynamodb = boto3.resource('dynamodb')
		table = dynamodb.Table(CONST_DYNAMODB_TICKER_TABLE_NAME)
		ticker_details = table.scan(**scan_kwargs).get('Items', [])
		# If the value does not exist
		if (len(ticker_details) == 0):
			# We initiate the value
			ticker_details = [{
				"uuid" : str(uuid.uuid4()),
				"platform" : event["platform"], 
				"ticker" : time_seed }]
			# The value is then fed back to its table
			response_dynamoDB = table.put_item(Item=ticker_details[0])
		ticker_val = int(ticker_details[0]["ticker"])
		print("ticker_val:", ticker_val)
		# We update the ticker value immediately
		table.update_item(
			Key={ "uuid" : ticker_details[0]["uuid"] },
			UpdateExpression="set ticker=:t",
			ExpressionAttributeValues={
				':t': ticker_val+(60*60)
			},
			ReturnValues="UPDATED_NEW"
		)
		# Load up the user schema
		response_s3 = {}
		this_schema = json.loads(open("schemas/schema_user.json").read())
		# Retrieve the users after the given date (technically it will retrieve after the given date and up to one hour thereafter)
		items = requests.post(CONSTANT_API_ENDPOINT,json={ 
			"event" : "get_users", 
			"afterDate" : int(ticker_val) }).json()
		# Generate the user data from S3, sanitise it, and upload it
		if (items != None) and ("Items" in items):
			items = items["Items"]
		all_user_data = []
		for user_lead in items:
			# For each user, we get their JSON from S3
			response_s3 = requests.get(s3.generate_presigned_url('get_object', 
				Params={'Bucket': CONSTANT_S3_BUCKET_NAME, 'Key': user_lead["uuid"]}, ExpiresIn=60), timeout=10).json()
			response_s3.update(user_lead)
			user_record_list = []
			# We then construct their JSON
			for user_record in insertion_user(response_s3, None, True):
				user_record_list.append(user_record['json'])
			all_user_data.extend(user_record_list)
		# We sanitise the data
		all_user_sanitised = []
		for row in all_user_data:
			evaluation = evaluate_row_against_schema(json.dumps(row), this_schema)
			if (evaluation["passed"]):
				all_user_sanitised.append(row)
			else:
				failed_tests += 1
				print("Failed at...")
				print(json.dumps(row))
		print("Uploading users...")
		# Then upload the data
		upload_json_to_bigquery("user", all_user_sanitised, schema=this_schema)
		return {
			'statusCode': 200,
			'body': json.dumps({
				"num_users_uploaded" : len(items),
				"ticker_val_start" : int(ticker_val),
				"ticker_val_end" : int(ticker_val)+(60*60)-1
			})
		}
	else:
		# A set of attempts are provided for sequential modes
		if (event["mode"] == "sequence"):
			if (not "attempts" in event):
				event["attempts"] = CONST_SEQUENTIAL_MODE_ATTEMPTS
		time_of_execution = int(time.time())
		# We only access the ticker if we are working with a sequential mode event
		ticker_val = None
		if (event["mode"] == "sequence"):
			# We attempt first to grab the ticker_val
			dynamodb = boto3.resource('dynamodb')
			table = dynamodb.Table(CONST_DYNAMODB_TICKER_TABLE_NAME)
			ticker_details = table.scan(**scan_kwargs).get('Items', [])
			# If the value does not exist
			if (len(ticker_details) == 0):
				# We initiate the value
				ticker_details = [{
					"uuid" : str(uuid.uuid4()),
					"platform" : event["platform"], 
					"ticker" : time_seed }]
				# The value is then fed back to its table
				response_dynamoDB = table.put_item(Item=ticker_details[0])
			ticker_val = int(ticker_details[0]["ticker"])
		else:
			# In the case of a one-off instance, the ticker_val variable is set to the supplied amount
			ticker_val = event["ticker_val"]
		# Generate the basic data for the statistic
		response = dict()
		response["id"] = str(uuid.uuid4())
		response["platform"] = event["platform"]
		response["time_of_execution"] = time_of_execution
		response["time_range_unix_timestamp_start"] = ticker_val
		response["time_range_unix_timestamp_end"] = ticker_val+(60*60)-1
		# The ticker_val variable is firstly updated for sequential modes.
		if (event["mode"] == "sequence"):
			table.update_item(
				Key={ "uuid" : ticker_details[0]["uuid"] },
				UpdateExpression="set ticker=:t",
				ExpressionAttributeValues={
					':t': response["time_range_unix_timestamp_end"]+1
				},
				ReturnValues="UPDATED_NEW"
			)
		can_be_uploaded = False
		was_uploaded = False
		encountered_error = False
		try:
			# The time range is specified
			min_t = response["time_range_unix_timestamp_start"] 
			max_t = response["time_range_unix_timestamp_end"]
			billed_duration_construction = time.time()
			print(event["platform"], min_t, max_t)
			# The data is retrieved from S3 for construction as BQ JSON
			items = request_to_json(event["platform"], min_t, max_t)
			boto3.resource('s3').Object("aw-datenspende-bq-bucket", "%s_%s_%s_raw" % (min_t, max_t, event["platform"])).put(Body=json.dumps(items))
			response["billed_duration_construction_seconds"] = time.time() - billed_duration_construction
			billed_duration_sanitisation = time.time()
			schemas = {}
			# All BQ schemas are loaded
			for s in CONST_TABLE_SCHEMA_FILES:
				schemas[s] = json.loads(open("schemas/%s" % (s)).read())
			# The data is sanitised by means of checking it against the BQ schemas
			response_additive, bigquery_data, can_be_uploaded = sanitise_json("%s_%s" % (min_t, max_t), items, schemas, CONST_REJECTION_THRESHOLD)
			response.update(response_additive)
			response["billed_duration_sanitisation_seconds"] = time.time() - billed_duration_sanitisation
			response["total_elements"] = len(items)
			# Depending on whether the data can be uploaded (this is in relation to the error margin threshold value)
			if (can_be_uploaded):
				billed_duration_upload = time.time()
				# All data is pushed up to BQ
				for k,v in bigquery_data.items():
					upload_json_to_bigquery(k,v,schemas["schema_%s.json" % (k)])
				response["billed_duration_upload_seconds"] = time.time() - billed_duration_upload
				was_uploaded = True
		except:
			# If an error is encountered, the reason is fed to the BQ statistic
			encountered_error = True
			response["error_string"] = traceback.format_exc()
		response["billed_duration_total_seconds"] = time.time() - billed_duration
		response["was_uploaded"] = was_uploaded
		response["encountered_error"] = encountered_error
		response["attempt"] = CONST_SEQUENTIAL_MODE_ATTEMPTS-event["attempts"]+1
		# The schema statistics are always produced - these can be later overridden through timestamps on time of execution - later executions may be conducted in case of errors
		boto3.resource('s3').Object("aw-datenspende-bq-bucket", "%s_%s_%s_statistics" % (min_t, max_t, event["platform"])).put(Body=json.dumps(response))
		upload_json_to_bigquery("schema_statistics",[response],json.loads(open("schema_statistics.json").read()))
		# If the function fails and we have enough attempts, reinitialise...
		event["attempts"] -= 1
		if ((encountered_error) and (event["attempts"] >= 1) and (event["mode"] != "onetime")):
			client = boto3.client("lambda")
			client.invoke(
				FunctionName = CONSTANT_AWS_LAMBDA_BQ_ARN,
				InvocationType = "Event",
				Payload = json.dumps({ 
					"platform" : event["platform"], 
					"ticker_val" : ticker_val, 
					"attempts" : event["attempts"],
					"mode" : "onetime" })
			)
		return {
			'statusCode': 200,
			'body': json.dumps(response)
		}
