'''
	This Lambda function calculates the number of users currently running the Australian Search Experience
	plugin within their web browser, as well as the number of search results that they have donated so far.
	Thereafter, it sends the result to a web location where it can be accessed by the Wordpress site.
'''

import json
import math
import boto3
import os

os.environ["GOOGLE_APPLICATION_CREDENTIALS"]= "creds.json"

from google.cloud import bigquery
bq = bigquery.Client()

dynamodb = boto3.resource('dynamodb')
client = boto3.client('dynamodb')

def lambda_handler(event, context):
	# Run a BigQuery query to get the number of rows within a given table
	def get_table_row_count(arg_table):
		return [x[0] for x in bq.query(
			"SELECT COUNT(*) FROM `adms-320005.australian_search_experience_dataset.%s`" % (arg_table)).result()][0]
	# The tables to index...
	google_search_tables = [
		'google_search_result', 
		'google_search_location', 
		'google_search_news_story', 
		'google_search_people_also_ask_result', 
		'google_search_people_also_search_for_result', 
		'google_search_related_searches_carousel_card', 
		'google_search_side_panel_snippet', 
		'google_search_twitter_tweet', 
		'google_search_videobox_video']
	google_news_tables = [
		'google_news_result']
	google_videos_tables = [
		'google_videos_tabulated_result']
	youtube_tables = [
		'youtube_channel',
		'youtube_movie',
		'youtube_playlist',
		'youtube_promoted_result',
		'youtube_video']
	# Calculate the required statistics
	n_users = client.describe_table(TableName="aw-datenspende-users")["Table"]["ItemCount"]
	user_stats = dict()
	sum_google_search = sum([get_table_row_count(x) for x in google_search_tables])
	sum_google_videos = sum([get_table_row_count(x) for x in google_videos_tables])
	sum_google_news = sum([get_table_row_count(x) for x in google_news_tables])
	sum_youtube = sum([get_table_row_count(x) for x in youtube_tables])
	user_stats["n_google_search"] = "{:,}".format(sum_google_search)
	user_stats["n_google_news"] = "{:,}".format(sum_google_news)
	user_stats["n_google_videos"] = "{:,}".format(sum_google_videos)
	user_stats["n_youtube"] = "{:,}".format(sum_youtube)
	user_stats["n_total"] = "{:,}".format(sum_google_search+sum_google_news+sum_google_videos+sum_youtube)
	user_stats["users"] = n_users
	# Upload the result to S3
	boto3.resource("s3") .Object("aw-datenspende-bucket", "user_stats.json").put(
		Body=json.dumps(user_stats), ACL="public-read", CacheControl="max-age=0,no-cache,no-store,must-revalidate", 
		ContentType="application/json")
	return { 'statusCode': 200, 'body' : json.dumps(dict()) }

if (__name__ == "__main__"):
	print(lambda_handler(None,None)["body"])
