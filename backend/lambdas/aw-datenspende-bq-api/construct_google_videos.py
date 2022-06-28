'''
	This is an extended utilities file for all functionality related to the data storage 
	process of data from the 'Google Videos' platform
'''

from utils import *
import traceback
import uuid

table_properties = get_table_properties()

'''
	This function inserts the Google Video JSON object into the BigQuery JSON file (for upload at a later stage)
'''
def insertion_google_videos(source_json, mode=None, params=None, s3routine=False, s3uuid=None):
	s3_data_list = []
	base_url = "https://www.google.com/search?tbm=vid&q=DYNAMIC_OPTIONS_KEYWORD&hl=DYNAMIC_NAVIGATOR_LANGUAGE"
	try:
		try:
			if (mode != None):
				this_json = dict()
				bigquery_uuid = str(uuid.uuid4())
				table_properties[mode]["iterator"] = bigquery_uuid
				this_json["id"] = table_properties[mode]["iterator"]
				if (mode == "google_videos_base"):
					# Add the connecting details that link the Google BigQuery entries to the S3 records
					s3_data_list.append({ "mode": "s3_bigquery", "json" : { "s3" : s3uuid, "bigquery" : bigquery_uuid, "type" : "google_videos" }})
					# Base details
					this_json["version"] = safecast(int,source_json.get("version").replace(".", ""))
					this_json["hash_key"] = source_json.get("hash_key")
					this_json["user_agent"] = source_json.get("user_agent")
					this_json["browser_type"] = source_json.get("browser")
					this_json["keyword"] = source_json.get("keyword")
					this_json["machine_type"] = source_json.get("interface")
					this_json["search_platform"] = source_json.get("platform")
					this_json["plugin_id"] = source_json.get("plugin_id")
					this_json["time_of_retrieval"] = datetime_from_timestamp(source_json.get("time_of_retrieval"))
					this_json["localisation"] = source_json.get("localisation")
					
					base_url = base_url.replace("DYNAMIC_OPTIONS_KEYWORD", urllib.parse.quote_plus(str(source_json.get("keyword"))))
					base_url = base_url.replace("DYNAMIC_NAVIGATOR_LANGUAGE", source_json.get("localisation"))

					this_json["url"] = base_url#.replace("DYNAMIC_OPTIONS_KEYWORD", urllib.parse.quote_plus(str(source_json.get("keyword"))).replace("DYNAMIC_NAVIGATOR_LANGUAGE", source_json.get("localisation")))
					if (source_json.get("data") != None):
						this_json["logged_in"] = source_json.get("data").get("logged_in")
						this_json["number_of_results_approximate"] = safecast(int,source_json.get("data").get("number_of_results_approximate"))
						this_json["seconds_taken_to_load_approximate"] = source_json.get("data").get("seconds_taken_to_load_approximate")
						this_json["suggestion_title_list"] = safelist(str, source_json.get("data").get("suggestions"), False, "title")
						this_json["suggestion_image_thumbnail_list"] = safelist(str, source_json.get("data").get("suggestions"), False, "image_thumbnail")
				if (mode == "google_videos_tabulated_result"):
					this_json["base_id"] = table_properties["google_videos_base"]["iterator"]
					this_json["publisher_url"] = source_json.get("publisher_url")
					this_json["list_index"] = params["list_index"]
					this_json["title"] = source_json.get("title")
					this_json["running_time"] = safecast(int,source_json.get("running_time"))
					this_json["image_thumbnail"] = source_json.get("image_thumbnail")
					this_json["source_url"] = source_json.get("source_url")
					if (source_json.get("subtitle") != None):
						this_json["subtitle_time_of_publication"] = source_json.get("subtitle").get("time_of_publication")
						this_json["subtitle_publisher"] = source_json.get("subtitle").get("publisher")
					if (source_json.get("header_link_object") != None):
						this_json["header_link_object_title"] = source_json.get("header_link_object").get("title")
						this_json["header_link_object_header_url"] = source_json.get("header_link_object").get("header_url")
					this_json["arrow_links"] = source_json.get("arrow_links")
					this_json["text"] = source_json.get("text")
			else:
				# Construction event
				s3_data_list.extend(insertion_google_videos(source_json, "google_videos_base", None, s3routine, s3uuid))
				if ((source_json.get("data") != None) 
					and (source_json["data"].get("tabulated_results") != None) 
					and (len(source_json["data"]["tabulated_results"]) > 0)):
						for i in range(len(source_json["data"]["tabulated_results"])):
							tabulated_result = source_json["data"]["tabulated_results"][i]
							s3_data_list.extend(insertion_google_videos(tabulated_result, "google_videos_tabulated_result", {"list_index" : i}, s3routine, s3uuid))
		except Exception  as e:
			print(e)
			pass
		if (mode != None):
			if (s3routine):
				s3_data_list.append({"mode": mode, "json" : this_json})
			else:
				write_instance(mode,this_json)
		return s3_data_list
	except Exception as e:
		print(e)
		traceback.print_exc()
		this_json = None
		return []