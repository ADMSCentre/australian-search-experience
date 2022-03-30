'''
	This is an assistant script intended for execution on your local machine. The script repairs the 
	contents of the BigQuery pipeline, and should be regularly run in order to determine the existence of errors
'''

import os
from google.cloud import bigquery
import boto3
import sys
import botocore
import time
import simplejson as json

AW_DATENSPENDE_BQ_API_ENDPOINT = "arn:aws:lambda:us-east-2:519969025508:function:aw-datenspende-bq-api"

'''
	Determine the status of BigQuery pipeline execution for a given platform and time window
	Returns whether an error was encountered, and under which ID
'''
def determine_status_of_platform_window(time_range_unix_timestamp_start, platform_in_question):
	os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "creds.json"
	client = bigquery.Client()
	# Retrieve the statistics of all Google BigQuery pipe events relative to some time window
	query_job = client.query(
		"""
		SELECT * 
		FROM `adms-320005.australian_search_experience_dataset.schema_statistics` 
		WHERE time_range_unix_timestamp_start = %s
		AND platform = '%s'
		""" % (time_range_unix_timestamp_start, platform_in_question)
	)
	results = query_job.result()
	max_time_execution = None
	did_encounter_error = False
	id_in_question = None
	result_in_q = None
	for result in results:
		if (max_time_execution is None) or (result.get("time_of_execution") > max_time_execution):
			max_time_execution = result.get("time_of_execution")
			did_encounter_error = result.get("encountered_error")
			id_in_question = result.get("id")
			result_in_q = result
	# Relate errors wherever they happen
	if (result_in_q != None):
		print("Identified hour %s on platform %s..." % (time_range_unix_timestamp_start, platform_in_question))
		print()
		if (did_encounter_error):
			print(result_in_q.get("error_string"))
		print()
		return id_in_question, did_encounter_error, str(max_time_execution)
	else:
		return None, False, None

'''
	Call the BigQuery one-off instance...
'''
def bq_oneoff(arg_platform, arg_ticker):
	cfg = botocore.config.Config(retries={'max_attempts': 0}, read_timeout=840, connect_timeout=600, region_name="us-east-2" )
	lambda_client = boto3.client("lambda", config=cfg)
	response = lambda_client.invoke(
		FunctionName = AW_DATENSPENDE_BQ_API_ENDPOINT,
		InvocationType = "RequestResponse",
		Payload = json.dumps({ 
			"platform" : arg_platform, 
			"ticker_val" : arg_ticker,
			"attempts" : 1,
			"mode" : "onetime" }))

	responseFromChild = json.load(response["Payload"])
	print(json.dumps(responseFromChild,indent=3))
	return responseFromChild

'''
	This function assists with chunking data
'''
def chunk_it(seq, num):
	avg = len(seq) / float(num)
	out = []
	last = 0.0
	while last < len(seq):
		out.append(seq[int(last):int(last + avg)])
		last += avg

	return out
			
'''
	Main function - Gather the failed scripts for the last X amount of time
'''
if __name__ == "__main__":

	if (sys.argv[1] == "generate"):
		'''
			Adjust the times as necessary...
		'''
		starting_date = 1627261200
		ending_date = 1631363230
		lst = (list(range(starting_date-(60*60), ending_date+(60*60), (60*60))))
		chunks = chunk_it(lst, 10)
		for x in chunks:
			print("python repair.py", x[0], x[-1])
	else:
		'''
			...or set the times via the command line
		'''
		starting_date = int(sys.argv[1])
		ending_date = int(sys.argv[2])
		corrected_errors = 0
		total_errors = 0
		for hour in (list(range(starting_date-(60*60), ending_date+(60*60), (60*60)))):
			for platform in ["google_videos"]:
				result = determine_status_of_platform_window(hour, platform)
				if (((result != None) and (result[1])) or ((len(sys.argv) >= 4))):
					el_time = int(time.time())
					print("Calling AWS Lambda now...")
					if (len(sys.argv) >= 4):
						print("* Forced event")
					response_v = bq_oneoff(platform, hour)
					print(response_v)
					if (not json.loads(response_v["body"])["encountered_error"]):
						corrected_errors += 1
						print("RESULT: SUCCESS!")
					else:
						print("RESULT: FAILURE!")
					print("Time taken: ", abs(int(time.time()) - el_time))
					print("\n\n\n")
					total_errors += 1
				else:
					print("RESULT: PASS - NO ERROR")
					print("\n\n\n")
		print("Repair is now complete; corrected %s/%s errors" % (corrected_errors, total_errors))