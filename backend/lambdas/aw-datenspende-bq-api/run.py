'''

	This is an assistant script intended for execution on your local machine, and supports the 'aw-datenspende-bq-api' API.
	The script corresponds to the Google BigQuery piping functionality from S3 for the AW Datenspende project. It is one of
	two major files, the other being the "lambda_function.py" file in the "aw-datenspende-bq-api" folder. 

    TODO - make tables non expiring on creation - and make partition expiry 0 (this should be automated)
    
'''

import subprocess
import sys
import boto3
import requests
import sys
import copy
import os
import re
import time
from utils import *
from google.cloud import bigquery
from os.path import isfile, join, realpath, dirname
from construct_google_search import *
from construct_google_videos import *
from construct_youtube import *
from construct_google_news import *
from construct_user import *

'''
	Constants
'''
all_table_tags = ["google_news", "google_search", "google_videos", "youtube", "user"]
os.environ["GOOGLE_APPLICATION_CREDENTIALS"]=join(os.getcwd(), "creds.json")
CONST_TEMP_JSON_FOLDER_NAME = "tmp_json"
CONST_TEST_JSON_FOLDER_NAME = "test_json"
CONST_SCHEMA_FOLDER_NAME = "schemas"
CONST_SEQUENTIAL_MODE_ATTEMPTS = 3
CONST_DYNAMODB_TICKER_TABLE_NAME = "aw-datenspende-bq-ticker"
CONST_SANITISED_JSON_FOLDER_NAME = "sanitised_json"
CONSTANT_AWS_LAMBDA_BQ_ARN = "arn:aws:lambda:us-east-2:519969025508:function:aw-datenspende-bq-api-v2"
CONSTANT_API_ENDPOINT = "https://65i9k6fick.execute-api.us-east-2.amazonaws.com/aw-datenspende-api"
CONSTANT_S3_BUCKET_NAME = "aw-datenspende-bucket"
CONSTANT_PROJECT_ID = json.loads(open(os.environ["GOOGLE_APPLICATION_CREDENTIALS"], 'r').read())['project_id']
CONSTANT_DATASET_ID = "australian_search_experience_dataset"
CONST_TABLE_SCHEMA_FILES = files_in_folder(join(os.getcwd(), "schemas"))
CONSTANT_TABLE_IDS = ([x.replace("schema_", "").replace(".json", "") for x in CONST_TABLE_SCHEMA_FILES])

bq = bigquery.Client()
s3 = boto3.client('s3')
table_properties = dict()
for table in CONSTANT_TABLE_IDS:
	table_properties[table] = { "iterator" : -1 }

'''
	This script is used to run asynchronous uploads to BigQuery
'''
def wait_for_job(job, sleep_secs=1):
	print("\t\t* Uploading some content to BigQuery...")
	while True:
		job.reload()
		if job.state == 'DONE':
			if job.error_result:
				#print("\t...encountered an error, keepin on going...")
				raise RuntimeError(job.errors)
			print("\t\t\t...The job is done!")
			job.result()
			return
		time.sleep(sleep_secs)
		print("\t\t\t...not done yet")


'''
	Generate a BigQuery table ID
'''
def formal_table_id(table_id):
	return "%s.%s.%s" % (CONSTANT_PROJECT_ID, CONSTANT_DATASET_ID, table_id)

'''
	Initiate all BigQuery tables for all schemas
'''
def initiate_biqquery_tables(platform):
	print("* Initiating BQ tables")
	for table_id in CONSTANT_TABLE_IDS:
		if (platform in table_id):
			# We delete the tables if they exist
			table_schema = json.loads(open(join(os.getcwd(), "schemas", "schema_%s.json" % (table_id)), 'r').read())
			bq.delete_table(formal_table_id(table_id), not_found_ok=True)
			bq.create_table(bigquery.Table(formal_table_id(table_id), schema=table_schema))
			print("\t...initiated table: %s" % (table_id))

'''
	Upload a JSON file from some ephemeral JSON to BigQuery
'''
def upload_json_to_bigquery(table_id, json, schema=None):
	print("\tPreparing to upload table: %s" % (table_id))
	job_config = bigquery.LoadJobConfig(
			source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
			autodetect=False)
	if (schema != None):
		job_config = bigquery.LoadJobConfig(
			schema=schema,
			source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
			autodetect=False)
	job = bq.load_table_from_json(json, formal_table_id(table_id), job_config=job_config)
	wait_for_job(job,0.5)

'''
	Upload a JSON file to BigQuery
'''
def upload_json_to_bigquery_from_file(table_id, fname, schema):
	print("\tPreparing to upload table: %s" % (table_id))
	with open(fname, "rb") as source_file:
		job = bq.load_table_from_file(source_file, formal_table_id(table_id), 
			job_config=bigquery.LoadJobConfig(
				source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
				autodetect=False))
		wait_for_job(job,1)

'''
	Route the JSON construction (depending on the platform)
'''
def route_json_construction(source_json, s3routine=False, s3uuid=None):
	json_version = source_json.get("version")
	if (json_version != None):
		if (int(json_version.replace(".","")) >= 1135):
			if (source_json.get("platform") == "google_videos"):
				return insertion_google_videos(source_json, None, None, s3routine, s3uuid)
			if (source_json.get("platform") == "google_search"):
				return insertion_google_search(source_json, None, None, s3routine, s3uuid)
			if (source_json.get("platform") == "youtube"):
				return insertion_youtube(source_json, None, None, s3routine, s3uuid)
			if (source_json.get("platform") == "google_news"):
				return insertion_google_news(source_json, None, None, s3routine, s3uuid)
		else:
			print("\t- Averting item of version %s" % (json_version))

'''
	Evaluate tmp_json folder - This function sanitises the tmp_json folder of rows that
	may be malformed
'''
def sanitise_json(platform):
	print("* Sanitising the test JSON files")
	sanitised_json_folder_name = "%s_%s" % (CONST_SANITISED_JSON_FOLDER_NAME, platform)
	os.system("rm -r %s; mkdir %s" % (sanitised_json_folder_name, sanitised_json_folder_name))
	tmp_json_files = (files_in_folder(join(os.getcwd(), CONST_TEMP_JSON_FOLDER_NAME)))
	# For every file in the tmp_json folder
	for file in tmp_json_files:
		if platform in file:
			file_ls = [x for x in open(join(os.getcwd(),CONST_TEMP_JSON_FOLDER_NAME,file)).read().split("\n") if (len(x) > 0)]
			this_schema = json.loads(open(join(os.getcwd(),CONST_SCHEMA_FOLDER_NAME,"schema_%s" % (file))).read())
			print("\tRunning %s through schema %s" % (file,"schema_%s" % (file)))
			# For every row
			total_tests = len(file_ls)
			failed_tests = 0
			sanitised_json_txt = ""
			with open(join(os.getcwd(), sanitised_json_folder_name, file), "a") as file_w:
				for row in file_ls:
					evaluation = evaluate_row_against_schema(row, this_schema)
					if (evaluation["passed"]):
						file_w.write(row+"\n")
					else:
						failed_tests += 1
						print(evaluation)
			print("\t\t...sanitisation succeeded on %s / %s tests" % ((total_tests-failed_tests), total_tests))


'''
	Run a test JSON construction for the designated platform
'''
def test_json_construction(platform):
	print("* Constructing the test JSON files")
	#os.system("rm -r %s; mkdir %s" % (CONST_TEMP_JSON_FOLDER_NAME, CONST_TEMP_JSON_FOLDER_NAME))
	route_json_construction(json.loads(open(join(CONST_TEST_JSON_FOLDER_NAME, 'test_file_%s_desktop.json' % (platform)),'r').read()))
	route_json_construction(json.loads(open(join(CONST_TEST_JSON_FOLDER_NAME, 'test_file_%s_mobile.json' % (platform)),'r').read()))

def up_to_bigquery(platform):
	print("* Sending the sanitised JSON up to BQ")
	for t in CONSTANT_TABLE_IDS:
		try:
			if (platform in t):
				json_to_put = json.loads(open(join(os.getcwd(), "%s_%s" % (CONST_SANITISED_JSON_FOLDER_NAME,platform), "%s.json" % (t)), "rb").read())
				upload_json_to_bigquery(table_id, json_to_put)
		except Exception as e:
			# Errors can be disregarded here for lack of data obtained for certain schemas
			print(e)
			pass

'''
	In order to assemble data for S3, we need to grab it from the AWS AW Datenspende API - local version
	This function will spin up a bunch of subprocesses, gradually putting together the BQ JSON.

	Note: This function is depreciated for the newer versions of the function (see aw-datenspende-bq-api/lambda_function.py ; request_to_json() ), 
	as the Node.js implementation within the aw-datespende-api on which this relies crashes, whereas the Pythonic implementation does not. 
'''
def request_to_json(platform, min_t=None, max_t=None):
	items = requests.get(CONSTANT_API_ENDPOINT, params={ "time_of_retrieval_min" : min_t, "time_of_retrieval_max" : max_t, "platform" : platform }).json()
	print("There are %s items to download" % (len(items)))
	# Then for each record, return the data from the corresponding file on S3
	parts = chunk_it(items, 10)
	if (len(parts) > 0):
		for i in range(len(parts[0])):
			for j in range(10):
				try:
					print("Pushing request for json of UUID %s" % (parts[j][i]['uuid']))
					proc = subprocess.Popen(["python", "run.py", "request_to_json_subprocess", parts[j][i]['uuid']], shell=False)
				except:
					print("Caught an unequal chunk error")
			# Loop until space for new processes
			while (len(re.findall("python",os.popen('ps ax | grep python').read())) > 15):
				print("......waiting on space for process")
				time.sleep(2)

if __name__ == "__main__":

	'''
		python run.py request_to_jon_subprocess <uuid>

		*** This is a subprocess for the 'request_to_json' procedure, as BQ JSON can only be 
		generated in chunks, rather than all at once.
	'''
	if (sys.argv[1] == "request_to_json_subprocess"):
		try:
			response = requests.get(s3.generate_presigned_url('get_object', 
				Params={'Bucket': CONSTANT_S3_BUCKET_NAME, 'Key': sys.argv[2]}, ExpiresIn=60), timeout=10).json()
			route_json_construction(response)
		except Exception as e:
			print(e)
			print("Error encountered while attempting to grab UUID: %s" % (sys.argv[2]))

		'''
			python run.py initiate_bq_tables_for_platform <value>

			*** This procedure initiates a set of BQ tables for a given platform
		'''
	elif (sys.argv[1] == "initiate_bq_tables_for_platform"):
		initiate_biqquery_tables(sys.argv[2])

		'''
			python run.py request_to_json <start> <end> <platform>

			*** This procedure generates the BQ JSON (within the tmp_json folder) for a given platform
				within a given time range.
		'''
	elif (sys.argv[1] == "request_to_json"):
		# Additionally, we may want to wipe the tmp_json folder
		#os.system("rm -r %s; mkdir %s" % (CONST_TEMP_JSON_FOLDER_NAME, CONST_TEMP_JSON_FOLDER_NAME))
		request_to_json(sys.argv[2], sys.argv[3], sys.argv[4])


		'''
			python run.py request_to_json_standalone 1627948800 1627952399 youtube

			Note: This function is depreciated for the newer versions of the function (see aw-datenspende-bq-api/lambda_function.py ; request_to_json() ), 
			as the Node.js implementation within the aw-datespende-api on which this relies crashes, whereas the Pythonic implementation does not. 
		'''
	elif (sys.argv[1] == "request_to_json_standalone"):
		print(requests.get(CONSTANT_API_ENDPOINT, params={ 
			"time_of_retrieval_min" : int(sys.argv[2]), 
			"time_of_retrieval_max" : int(sys.argv[3]), 
			"platform" : sys.argv[4] }).json())

		'''
			python run.py sanitise <platform>

			*** This procedure sanitises the BQ JSON for a given platform
		'''
	elif (sys.argv[1] == "sanitise"):
		platform = sys.argv[2]
		sanitise_json(platform)

		'''
			python run.py test_construct <platform>

			*** This procedure runs the dummy test files on the BQ schema for a given platform.
				NB. Check that the test files are indeed in the test_json folder before running this.
		'''
	elif (sys.argv[1] == "test_construct"):
		platform = sys.argv[2]
		test_json_construction(platform)

		'''
			python run.py test_runthrough <platform>

			*** This procedure runs a test through the entire process (JSON construction, sanitisation, and BQ upload)

		'''
	elif (sys.argv[1] == "test_runthrough"):
		platform = sys.argv[2]
		# Initiate the BQ tables
		initiate_biqquery_tables(platform)
		# Run the tests on the BQ schemas
		test_json_construction(platform)
		# Sanitise the BQ JSON for the tests
		sanitise_json(platform)
		# Send the sanitised BQ JSON up to BQ
		up_to_bigquery(platform)

		'''
			python run.py initiate_all_tables

			*** Initiate all the BQ tables from the "schemas" folder
		'''
	elif (sys.argv[1] == "initiate_all_tables"):
		for platform in all_table_tags:
			initiate_biqquery_tables(platform)

		'''
			python run.py sanitise_all_tables

			*** For all platforms, sanitise all JSON within the tmp_json folder
		'''
	elif (sys.argv[1] == "sanitise_all_tables"):
		for platform in all_table_tags:
			sanitise_json(platform)


		'''
			python run.py upload_all_tables

			*** For all platforms, upload all tables that have been sanitised
		'''
	elif (sys.argv[1] == "upload_all_tables"):
		for platform in all_table_tags:
			up_to_bigquery(platform)

		'''
			python run.py construct_all_json

			*** For a time range, construct the associated JSON files in accordance with the BQ tables.
		'''
	elif (sys.argv[1] == "construct_all_json"):

		# Optionally, we may wipe the tmp_json folder
		#os.system("rm -r %s; mkdir %s" % (CONST_TEMP_JSON_FOLDER_NAME, CONST_TEMP_JSON_FOLDER_NAME))

		# Get all records for the designated platform, between July 1 and July 28
		min_t = 1627434000 # 28th of July 2021
		max_t = 1627736400 # Some date after the 28th of July 2021
		day = (60*60*24)
		day_range = list(range(min_t,max_t,day))
		for platform in ["google_videos"]:
			print("* Indexing platform: %s" % (platform))
			for i in range(len(day_range[:-1])):
				this_min_t = day_range[i]
				this_max_t = day_range[i+1]-1
				print("+ Executing range : %s -> %s" % (str(this_min_t), str(this_max_t)))
				request_to_json(platform, this_min_t, this_max_t)
		
		'''
			python run.py construct_users

			*** Construct the BQ JSON for the "user" table in preparation of submission to BQ. This will completely wipe
			the "user" table, replacing it with the exact 'up-to-date' data from S3.
 		'''
	elif (sys.argv[1] == "construct_users"):
		# Retrieve all users from S3
		this_schema = json.loads(open("schemas/schema_user.json").read())
		items = requests.post(CONSTANT_API_ENDPOINT,json={ "event" : "get_users" }).json()
		if (items != None) and ("Items" in items):
			items = items["Items"]
		all_user_data = []
		for user_lead in items:
			# For each user, we assemble their JSON
			response = requests.get(s3.generate_presigned_url('get_object', 
				Params={'Bucket': CONSTANT_S3_BUCKET_NAME, 'Key': user_lead["uuid"]}, ExpiresIn=60), timeout=10).json()
			response.update(user_lead)
			user_record_list = []
			for user_record in insertion_user(response, None, True):
				user_record_list.append(user_record['json'])
			all_user_data.extend(user_record_list)
		all_user_sanitised = []
		for row in all_user_data:
			evaluation = evaluate_row_against_schema(json.dumps(row), this_schema)
			if (evaluation["passed"]):
				all_user_sanitised.append(row)
			else:
				failed_tests += 1
				print("Failed at...")
				print(json.dumps(row))
		print(all_user_sanitised)
		print("Wiping table...")
		initiate_biqquery_tables("user")
		print("Uploading users...")
		upload_json_to_bigquery("user", all_user_sanitised, schema=this_schema)
		
		'''
			python run.py initiate_statistics_table
			
			*** This procedure polls the schema of all tables within BQ, and generates (or wipes)
				a corresponding statistics table that is then readily available on BQ.
		'''
	elif (sys.argv[1] == "initiate_statistics_table"):
		# The template is firstly retrieved
		statistics_schema = json.loads(open("schema_statistics_template.json").read())
		# For all schemas, generated corresponding stats
		for s in CONST_TABLE_SCHEMA_FILES:
			if ("s3_bigquery" not in s):
				s_field = s.replace("schema_","")
				s_field = s.replace(".json","")
				for x in ["_total_elements_n","_failed_elements_n","_succeeded_elements_n"]:
					statistics_schema.append({
						"description" : "A field associated with the number of processed elements in a given schema.",
						"mode" : "NULLABLE",
						"name" : s_field+x,
						"type" : "INT64"
						})
		# Create the JSON schema for this table
		with open("schema_statistics.json", 'w') as file:
			file.write(json.dumps(statistics_schema))
		# Push this table to BQ
		bq.delete_table(formal_table_id("schema_statistics"), not_found_ok=True)
		bq.create_table(bigquery.Table(formal_table_id("schema_statistics"), schema=statistics_schema))

		'''
			python run.py initiate_dynamodb_ticker_table <an initial value>

			*** This procedure initiates the DynamoDB ticker values that are responsible for the 
				sequential BQ push routines associated with the aw-datenspende-api AWS Lambda function.
		'''
	elif (sys.argv[1] == "initiate_dynamodb_ticker_table"):
		all_table_tags_tickers = all_table_tags
		dynamodb = boto3.resource('dynamodb')
		table = dynamodb.Table(CONST_DYNAMODB_TICKER_TABLE_NAME)
		for platform in all_table_tags_tickers:
			table.put_item(Item={
				"uuid" : str(uuid.uuid4()),
				"platform" : platform, 
				"ticker" : int(sys.argv[2]) })

		'''
			python run.py populate_bq_oneoff_at <value> <platform>

			*** This procedure populates BQ at a given time range, with no secondary attempts
				(intended for debugging purposes, when the "encountered_error" field of the statistics
				table has a row of value "true").
		'''
	elif (sys.argv[1] == "populate_bq_oneoff_at"):
		import botocore
		cfg = botocore.config.Config(retries={'max_attempts': 0}, read_timeout=840, connect_timeout=600, region_name="us-east-2" )
		lambda_client = boto3.client("lambda", config=cfg)
		response = lambda_client.invoke(
			FunctionName = CONSTANT_AWS_LAMBDA_BQ_ARN,
			InvocationType = "RequestResponse",
			Payload = json.dumps({ 
				"platform" : sys.argv[3], 
				"ticker_val" : int(sys.argv[2]),
				"attempts" : CONST_SEQUENTIAL_MODE_ATTEMPTS,
				"mode" : "onetime" }))

		responseFromChild = json.load(response["Payload"])
		print(json.dumps(responseFromChild,indent=3))

		'''
			python run.py populate_bq_oneoff_backfill <now> <back_then>
	
				

			*** This procedure backfills BQ for the given time range.
				(NB: It can be very expensive to run this function regularly. Consult the throughput of
				the "aw-datenspende" AWS DynamoDB table (RCU), the memory and duration configurations 
				for the "aw-datenspende-api" and "aw-datenspende-bq-api" AWS Lambda functions, and the
				rate limits of the accepting BigQuery tables. Additionally, if AWS EventBridge is running
				simultaneously, cross-check that it does not overwhelm any of the forementioned infrastructures).

				E.g. python run.py populate_bq_oneoff_backfill 1627909200 1625144461
		'''
	elif (sys.argv[1] == "populate_bq_oneoff_backfill"):
		now = int(sys.argv[2])
		back_then = int(sys.argv[3])
		invoked_lambdas = 0
		lambda_client = boto3.client("lambda")
		all_table_tags_lambda = all_table_tags
		all_table_tags_lambda.remove("user")
		while (now > back_then):
			now -= (60*60) # Subtract an hour
			# For all platforms, run the aw-datenspende-bq-api AWS Lambda function...
			for platform in all_table_tags_lambda:
				invoked_lambdas += 1
				print("Invoking AWS Lambda BQ function for %s with ticker_val = %s..." % (platform, now))
				lambda_client.invoke(
					FunctionName = CONSTANT_AWS_LAMBDA_BQ_ARN,
					InvocationType = "Event",
					Payload = json.dumps({ 
						"platform" : platform, 
						"ticker_val" : now,
						"attempts" : CONST_SEQUENTIAL_MODE_ATTEMPTS,
						"mode" : "onetime" }))
				# Sleep for 15 seconds after every invocation (you may need to adjust this to suit your provisioned database throughput)
				print("Sleeping for 1 seconds while databases recover...")
				time.sleep(1)
		print("Invoked %s lambdas" % (invoked_lambdas))

		'''
			python run.py user_append_from_date 

			*** This function will call a sequence of the function responsible for sequentially populating the 
			"user" BQ table. Although the "initiate_dynamodb_ticker_table" will have a preset value for the "user" BQ 
			table, you will have to manually set the ticker to the current time (in seconds) after running the 
		'''
	elif (sys.argv[1] == "user_append_from_date"):
		import botocore
		cfg = botocore.config.Config(retries={'max_attempts': 0}, read_timeout=840, connect_timeout=600, region_name="us-east-2" )
		lambda_client = boto3.client("lambda", config=cfg)
		response = lambda_client.invoke(
			FunctionName = CONSTANT_AWS_LAMBDA_BQ_ARN,
			InvocationType = "RequestResponse",
			Payload = json.dumps({ 
				"platform" : "user",
				"mode" : "user_append" }))

		responseFromChild = json.load(response["Payload"])
		print(responseFromChild)
		#print(json.dumps(json.loads(responseFromChild),indent=3))
	elif (sys.argv[1] == "bq_create_keyword_set_table"):
		schema_keyword_sets = json.loads(open("schemas/schema_keyword_sets.json").read())
		bq.delete_table(formal_table_id("keyword_sets"), not_found_ok=True)
		bq.create_table(bigquery.Table(formal_table_id("keyword_sets"), schema=schema_keyword_sets))
	elif (sys.argv[1] == "bq_create_s3_bigquery_table"):
		schema_s3_bigquery = json.loads(open("schemas/schema_s3_bigquery.json").read())
		bq.delete_table(formal_table_id("s3_bigquery"), not_found_ok=True)
		bq.create_table(bigquery.Table(formal_table_id("s3_bigquery"), schema=schema_s3_bigquery))
	else:
		'''
			Synthesize fo
		
		'''
		'''
		# Create output folder
		bq_oneshot_folder_name = "bq_oneshot"
		# We need to wipe the folder before execution
		os.system("rm -r %s; mkdir %s" % (bq_oneshot_folder_name, bq_oneshot_folder_name))
		# We access the S3 bucket with all the generated data
		s3r = boto3.resource('s3')
		my_bucket = s3r.Bucket('aw-datenspende-bq-bucket')
		# And we then compile the data into the "bq_oneshot" folder
		for my_bucket_object in my_bucket.objects.all():
			destination_file = None
			print(my_bucket_object)
			if ("statistics" in my_bucket_object.key):
				destination_file = "schema_statistics_sanitised.json"
			elif ("sanitised" in my_bucket_object.key):
				destination_file = "_".join(my_bucket_object.key.split("_")[2:])+".json"
			if (destination_file != None):
				response = requests.get(s3.generate_presigned_url('get_object', 
					Params={'Bucket': "aw-datenspende-bq-bucket", 'Key': my_bucket_object.key}, ExpiresIn=60), timeout=10).json()
				if (type(response) != type(list())):
					response = [response]
				with open(join(os.getcwd(),bq_oneshot_folder_name,destination_file), "a") as file_w:
					for x in response:
						file_w.write(json.dumps(x)+"\n")
		sys.exit()
		
		table_id_for_upload = ([x.replace("_sanitised.json","") for x in files_in_folder(join(os.getcwd(), "bq_oneshot"))])
		
		for t_id in table_id_for_upload:
			this_schema = None
			if (not "statistics" in t_id):
				this_schema = json.loads(open(join(os.getcwd(), "schemas", "schema_"+t_id+".json")).read())
			else:
				this_schema = json.loads(open(join(os.getcwd(), "schema_statistics.json")).read())
			upload_json_to_bigquery_from_file(
				t_id, 
				join(os.getcwd(), "bq_oneshot", t_id+"_sanitised.json"),
				this_schema)
		'''