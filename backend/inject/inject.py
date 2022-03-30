'''
	This script is responsible for injecting regularly updated scraping mechanisms, and queryable keywords
	into the plugin in real-time.
'''

import boto3
import sys
import os
import uuid
from google.cloud import bigquery
import json
import time
import datetime
from os.path import isfile, join, realpath, dirname

'''
	Constants
'''
os.environ["GOOGLE_APPLICATION_CREDENTIALS"]=join(os.getcwd(), "creds.json")
CONSTANT_S3_BUCKET_NAME = "aw-datenspende-bucket"
CONSTANT_PROJECT_ID = json.loads(open(os.environ["GOOGLE_APPLICATION_CREDENTIALS"], 'r').read())['project_id']
CONSTANT_DATASET_ID = "australian_search_experience_dataset"

bq = bigquery.Client()
s3 = boto3.client('s3')

'''
	Creates a datetime string from an integer (in seconds)
'''
def datetime_from_timestamp(timestamp):
	rtn = None
	if (timestamp != None):
		rtn = datetime.datetime.fromtimestamp(int(timestamp)).strftime('%Y-%m-%d %H:%M:%S')
	return rtn

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
	Upload a JSON file from the temporary JSON folder to BigQuery
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


if (sys.argv[1] == "bq"):
	'''
		* Push the keyword set to bigquery
		Usage: python inject.py bq 1.1.4.5
	'''
	schema_keyword_sets = json.loads(open(os.getcwd()+"/../bigquery/schemas/schema_keyword_sets.json").read())
	this_keywords = json.loads(open(os.getcwd()+("/inject.%s.json" % (sys.argv[2]))).read())["keywords"]
	this_version = sys.argv[2]
	this_id = str(uuid.uuid4())
	this_date_added = datetime_from_timestamp(int(time.time())) # Get the current time
	json_for_upload = {
		"id" : this_id,
		"version" : this_version,
		"keyword_set" : this_keywords,
		"date_added" : this_date_added
		}
	upload_json_to_bigquery("keyword_sets", [json_for_upload], schema=schema_keyword_sets)
else:
	'''
		* Push the keyword set to S3
		Usage: python inject.py 1.1.4.5
	'''
	s3 = boto3.resource('s3')
	CONSTANT_S3_BUCKET_NAME = "aw-datenspende-bucket"
	CONSTANT_S3_FILE_NAME = "inject.%s.json" % (sys.argv[1])

	print("Uploading %s..." % (CONSTANT_S3_FILE_NAME))

	s3.Object(CONSTANT_S3_BUCKET_NAME, CONSTANT_S3_FILE_NAME).put(
		Body=open(CONSTANT_S3_FILE_NAME, 'r').read(),
		ACL='public-read', 
		ContentType='application/json')


