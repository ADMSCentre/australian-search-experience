'''
	This is an extended utilities file for all functionality related to the data storage 
	process of data from the 'Google News' platform
'''

from utils import *
import traceback
import uuid

table_properties = get_table_properties()

'''
	Construct the necessary insertion of the data
'''
def insertion_google_news(source_json, mode=None, params=None, s3routine=False):
	s3_data_list = []
	base_url = "https://news.google.com/search?hl=DYNAMIC_NAVIGATOR_LANGUAGE&q=DYNAMIC_OPTIONS_KEYWORD"
	interface = safeget(source_json,["interface"]) # May initialise as None in some instances; should work where relevant
	try:
		if (mode != None):
			this_json = dict()
			table_properties[mode]["iterator"] = str(uuid.uuid4())
			this_json["id"] = table_properties[mode]["iterator"]
			if (mode == "google_news_base"):
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
				this_json["url"] = base_url
				# If there is data in this JSON object
				data = safeget(source_json,["data"])
				if ((data != None) and (type(data) == dict)):
					this_json["logged_in"] = (safecast(bool, safeget(data,["logged_in"])) == True)
					if (interface == "desktop"):
						this_json["topic_title"] = safeget(data,["topic","title"])
						this_json["topic_thumbnail"] = safeget(data,["topic","image_thumbnail"])
			elif (mode == "google_news_result"):
				# Google News Result
				this_json["base_id"] = table_properties["google_news_base"]["iterator"]
				this_json["type"] = params["type"]
				this_json["list_index"] = params["list_index"]
				this_json["title"] = safeget(source_json,["title"])
				this_json["subtitle"] = safeget(source_json,["subtitle"])
				this_json["image_thumbnail"] = safeget(source_json,["image_thumbnail"])
				this_json["publisher"] = safeget(source_json,["publisher"])
				this_json["time_of_publication"] = safeget(source_json,["time_of_publication"])
				this_json["source_url"] = safeget(source_json,["source_url"])
		else:
			# Construction event
			s3_data_list.extend(insertion_google_news(source_json, "google_news_base", None, s3routine))
			# Google News results
			interface_news_result = "desktop"
			if (interface != "desktop"):
				interface_news_result = "mobile"
				# News poster results
				tabulated_poster_results = safeget(source_json,["data","news_poster_result"])
				if (tabulated_poster_results != None) and (type(tabulated_poster_results) == list):
					for i in range(len(tabulated_poster_results)):
						s3_data_list.extend(insertion_google_news(tabulated_poster_results[i], "google_news_result", {"list_index" : i, "type" : "mobile_poster"}, s3routine))
			# General news results
			tabulated_results = safeget(source_json,["data","news_results"])
			if (tabulated_results != None) and (type(tabulated_results) == list):
				for i in range(len(tabulated_results)):
					s3_data_list.extend(insertion_google_news(tabulated_results[i], "google_news_result", {"list_index" : i, "type" : interface_news_result}, s3routine))

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
		