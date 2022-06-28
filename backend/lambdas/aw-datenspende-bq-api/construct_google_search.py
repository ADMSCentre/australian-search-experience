'''
	This is an extended utilities file for all functionality related to the data storage 
	process of data from the 'Google Search' platform
'''

from utils import *
import traceback
import uuid

table_properties = get_table_properties()

'''
	Determine if the Google Search 'News Stories' module exists
'''
def google_search_has_news_stories_module(main_panel, source_json):
	if (main_panel != None):
		top_stories = main_panel.get("module_top_stories")
		if (top_stories != None):
			if (source_json.get("interface") == "desktop"):
				# Desktop event...
				# Local news
				local_news_n = 0
				if ((main_panel.get("module_local_news") != None) 
					and (main_panel.get("module_local_news").get("tabulated_columns" != None))):
					local_news_n = len(main_panel.get("module_local_news").get("tabulated_columns"))
				# Top stories - rows
				tabulated_rows_n = 0
				if (top_stories.get("tabulated_rows") != None):
					tabulated_rows_n = len(top_stories.get("tabulated_rows"))
				# Top stories - columns
				tabulated_cols_n = 0
				if (top_stories.get("tabulated_columns") != None):
					tabulated_cols_n = len(top_stories.get("tabulated_columns"))
					return ((local_news_n + tabulated_rows_n + tabulated_cols_n) > 0)
				else:
					return False
			else:
				# Mobile event...
				if (main_panel.get("module_top_stories") != None):
					return (len(top_stories) > 0)
				else:
					return False
		else:
			return False
	else:
		return False

'''
	Determine if the Google Search 'Twitter' module exists
'''
def google_search_has_twitter_module(main_panel, source_json):
	if (main_panel != None):
		twitter = main_panel.get("module_twitter")
		if (twitter != None):
			if (source_json.get("interface") == "desktop"):
				# Desktop event...
				if (twitter.get("tweets") != None):
					return (len(twitter.get("tweets")) > 0)
				else:
					return False		
			else:
				# Mobile event...
				# Tweets - rows
				row_tweets_n = 0
				if (twitter.get("row_tweets") != None):
					row_tweets_n = len(twitter.get("row_tweets"))
				# Tweets - columns
				col_tweets_n = 0
				if (twitter.get("column_tweets") != None):
					col_tweets_n = len(twitter.get("column_tweets"))
				return ((row_tweets_n + col_tweets_n) > 0)
		else:
			return False
	else:
		return False

'''
	Construct the Google Search 'Images' module
'''
def google_search_images_module(this_json, main_panel, source_json):
	images = main_panel.get("module_images")
	if (images != None):
		images_list = None
		if (source_json.get("interface") == "desktop"):
			# Desktop event...
			images_list = images.get("images")
			this_json["main_panel_module_images_title"] = images.get("title")
		else:
			# Mobile event...
			images_list = images # On mobiles, the image list is the 'images' key
		if (images_list != None):
			this_json["main_panel_module_images_image_thumbnails"] = safelist(str, images_list, False, "image_thumbnail")
			this_json["main_panel_module_images_source_urls"] = safelist(str, images_list, False, "source_url")
							
	else:
		pass
	return this_json

'''
	Construct the necessary insertion of the data
'''
def insertion_google_search(source_json, mode=None, params=None, s3routine=False, s3uuid=None):
	s3_data_list = []
	base_url = "https://google.com/search?ned=DYNAMIC_NAVIGATOR_LANGUAGE&hl=DYNAMIC_NAVIGATOR_LANGUAGE&q=DYNAMIC_OPTIONS_KEYWORD"
	# We retain the UUID for BigQuery insertion
	try:
		if (mode != None):
			this_json = dict()
			bigquery_uuid = str(uuid.uuid4())
			table_properties[mode]["iterator"] = bigquery_uuid
			this_json["id"] = table_properties[mode]["iterator"]
			if (mode == "google_search_base"):
				# Add the connecting details that link the Google BigQuery entries to the S3 records
				s3_data_list.append({ "mode": "s3_bigquery", "json" : { "s3" : s3uuid, "bigquery" : bigquery_uuid, "type" : "google_search" }})
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
				# If there is data in this JSON object
				if ((type(source_json) == dict) and (source_json.get("data") != None) and (type(source_json.get("data")) == dict)):
					data = source_json.get("data")
					this_json["logged_in"] = True if (data.get("logged_in")) else False
					# If there is a main panel
					if (data.get("main_panel") != None):
						main_panel = data.get("main_panel")
						# Does the 'News Stories' module exist?
						this_json["main_panel_news_stories_exists"] = google_search_has_news_stories_module(main_panel, source_json)
						# Does the 'Twitter' module exist?
						this_json["main_panel_module_twitter_exists"] = google_search_has_twitter_module(main_panel, source_json)
						# Construct the 'Images' module
						this_json = google_search_images_module(this_json, main_panel, source_json)

						this_json["main_panel_result_type"] = cleanlist(safelist(str, main_panel.get("result_types"), remove_nulls=True),"")
						this_json["main_panel_number_of_results_approximate"] = safecast(int, main_panel.get("number_of_results_approximate"))
						this_json["main_panel_seconds_taken_to_load_approximate"] = safecast(float, main_panel.get("seconds_taken_to_load_approximate"))
						if (source_json.get("interface") != "desktop"):
							if (this_json["main_panel_module_twitter_exists"]):
								module_twitter = main_panel.get("module_twitter")
								if (module_twitter != None):
									this_json["main_panel_module_twitter_image_thumbnail"] = module_twitter.get("image_thumbnail")
							this_json["main_panel_module_locations_exists"] = False
							this_json["main_panel_side_panel_exists"] = False
							side_panel = source_json.get("data").get("side_panel")
							if (len(list(side_panel.get("side_panel_lower").keys())) > 0):
								this_json["main_panel_side_panel_exists"] = True
								this_json["main_panel_side_panel_is_requesting_claimer"] = source_json.get("data").get("side_panel").get("side_panel_lower").get("is_requesting_claimer")
								this_json["main_panel_side_panel_source_url"] = source_json.get("data").get("side_panel").get("side_panel_lower").get("source_url")
							if (len(list(side_panel.get("side_panel_upper").keys())) > 0):
								this_json["main_panel_side_panel_exists"] = True
								this_json["main_panel_side_panel_title"] = source_json.get("data").get("side_panel").get("side_panel_upper").get("title")
								this_json["main_panel_side_panel_subtitle"] = source_json.get("data").get("side_panel").get("side_panel_upper").get("subtitle")
								this_json["main_panel_side_panel_image_thumbnail"] = source_json.get("data").get("side_panel").get("side_panel_upper").get("image_thumbnail")
							if (source_json.get("data").get("main_panel").get("module_related_searches") != None):
								this_json["main_panel_related_searches_tabulated_row_titles"] = safelist(str, source_json.get("data").get("main_panel").get("module_related_searches").get("tabulated_rows"), False, "title")

							if (source_json.get("data").get("main_panel").get("module_people_also_search_for").get("people") != None):
								this_json["main_panel_people_also_search_for_people_titles"] = safelist(str, source_json.get("data").get("main_panel").get("module_people_also_search_for").get("people"), False, "title")
							if (source_json.get("data").get("main_panel").get("module_people_also_search_for").get("people") != None):
								this_json["main_panel_people_also_search_for_people_image_thumbnails"] = safelist(str, source_json.get("data").get("main_panel").get("module_people_also_search_for").get("people"), False, "image_thumbnail")
						else:
							# Desktop
							this_json["main_panel_module_locations_exists"] = (len(source_json.get("data").get("main_panel").get("module_locations")) > 0)
							this_json["main_panel_module_video_showcase_title"] = source_json.get("data").get("main_panel").get("module_video_showcase").get("title")
							this_json["main_panel_module_video_showcase_source_url"] = source_json.get("data").get("main_panel").get("module_video_showcase").get("source_url")
							this_json["main_panel_module_video_showcase_subtitle"] = source_json.get("data").get("main_panel").get("module_video_showcase").get("subtitle")
							this_json["main_panel_module_video_showcase_image_thumbnail"] = source_json.get("data").get("main_panel").get("module_video_showcase").get("image_thumbnail")
							this_json["main_panel_module_video_showcase_publisher_url"] = source_json.get("data").get("main_panel").get("module_video_showcase").get("publisher_url")
							this_json["main_panel_side_panel_exists"] = False
							if (len(list(source_json.get("data").get("side_panel").keys())) > 0):
								this_json["main_panel_side_panel_exists"] = True
								this_json["main_panel_side_panel_is_requesting_claimer"] = source_json.get("data").get("side_panel").get("is_requesting_claimer")
								this_json["main_panel_side_panel_source_url"] = source_json.get("data").get("side_panel").get("source_url")
								this_json["main_panel_side_panel_title"] = source_json.get("data").get("side_panel").get("title")
								this_json["main_panel_side_panel_subtitle"] = source_json.get("data").get("side_panel").get("subtitle")
							if (source_json.get("data").get("main_panel").get("module_related_searches").get("related_terms") != None):
								this_json["main_panel_related_searches_term_source_urls"] = safelist(str, source_json.get("data").get("main_panel").get("module_related_searches").get("related_terms"), False, "source_url")
							if (source_json.get("data").get("main_panel").get("module_related_searches").get("related_terms") != None):
								this_json["main_panel_related_searches_term_HTMLs"] = safelist(str, source_json.get("data").get("main_panel").get("module_related_searches").get("related_terms"), False, "HTML")
							if (source_json.get("data").get("main_panel").get("module_related_searches").get("carousels") != None):
								this_json["main_panel_related_searches_carousel_titles"] = safelist(str, source_json.get("data").get("main_panel").get("module_related_searches").get("carousels"), False, "title")
							this_json["main_panel_page_numberings"] = cleanlist(safelist(str, source_json.get("data").get("main_panel").get("page_numberings"), True, "term"),"")
						this_json["main_panel_people_also_ask_exists"] = (len(main_panel.get("module_people_also_ask")) > 0)
						this_json["main_panel_module_twitter_source_url"] = main_panel.get("module_twitter").get("source_url")
						this_json["main_panel_module_twitter_title"] = main_panel.get("module_twitter").get("title")
						this_json["main_panel_module_videobox_exists"] = (len(main_panel.get("module_video_box").get("video")) > 0)
						this_json["main_panel_module_outlinks_exists"] = (len(main_panel.get("module_available_outlinks")) > 0)
						this_json["main_panel_outlinks_source_urls"] = safelist(str, main_panel.get("module_available_outlinks"), False, "source_url")
						this_json["main_panel_outlinks_publishers"] = safelist(str, main_panel.get("module_available_outlinks"), False, "publisher")
			if (mode == "google_search_location"):
				this_json["base_id"] = table_properties["google_search_base"]["iterator"]
				this_json["list_index"] = params["list_index"]
				this_json["image_thumbnail"] = source_json.get("image_thumbnail")
				this_json["title"] = source_json.get("title")
				if (source_json.get("stripped_html") != None):
					this_json["stripped_html_HTML"] = source_json.get("stripped_html").get("HTML")
					this_json["stripped_html_source_urls"] = safelist(str, source_json.get("stripped_html").get("source_urls"))
					this_json["stripped_html_media_thumbnail_urls"] = safelist(str, source_json.get("stripped_html").get("media_thumbnail_urls"))
			if (mode == "google_search_news_story"):
				this_json["base_id"] = table_properties["google_search_base"]["iterator"]
				this_json["list_index"] = params["list_index"]
				this_json["class"] = params["class"]
				this_json["type"] = params["type"]
				this_json["container_index"] = params.get("container_index")
				this_json["source_url"] = source_json.get("source_url")
				this_json["publisher"] = source_json.get("publisher")
				this_json["publisher_url"] = source_json.get("publisher_url")
				this_json["title"] = source_json.get("title")
				this_json["time_of_publication"] = source_json.get("time_of_publication")
				this_json["is_video"] = safecast(bool,source_json.get("is_video"))
				this_json["media_thumbnail_url"] = source_json.get("media_thumbnail_url")
			if (mode == "google_search_people_also_ask_result"):
				this_json["base_id"] = table_properties["google_search_base"]["iterator"]
				this_json["list_index"] = params["list_index"]
				this_json["title"] = source_json.get("title")
				this_json["arrow_links"] = source_json.get("arrow_links")
				if (source_json.get("stripped_html") != None):
					this_json["stripped_html_HTML"] = source_json.get("stripped_html").get("HTML")
					this_json["stripped_html_source_urls"] = safelist(str, source_json.get("stripped_html").get("source_urls"))
					this_json["stripped_html_media_thumbnail_urls"] = safelist(str, source_json.get("stripped_html").get("media_thumbnail_urls"))
			if (mode == "google_search_people_also_search_for_result"):
				this_json["base_id"] = table_properties["google_search_base"]["iterator"]
				this_json["list_index"] = params["list_index"]
				this_json["title"] = source_json.get("title")
				if (source_json.get("stripped_html") != None):
					this_json["stripped_html_HTML"] = source_json.get("stripped_html").get("HTML")
					this_json["stripped_html_source_urls"] = safelist(str, source_json.get("stripped_html").get("source_urls"))
					this_json["stripped_html_media_thumbnail_urls"] = safelist(str, source_json.get("stripped_html").get("media_thumbnail_urls"))
			if (mode == "google_search_related_searches_carousel_card"):
				this_json["base_id"] = table_properties["google_search_base"]["iterator"]
				this_json["carousel_index"] = params["carousel_index"]
				this_json["list_index"] = params["list_index"]
				this_json["title"] = source_json.get("title")
				this_json["source_url"] = source_json.get("source_url")
				this_json["image_thumbnail"] = source_json.get("image_thumbnail")
			if (mode == "google_search_result"):
				this_json["base_id"] = table_properties["google_search_base"]["iterator"]
				this_json["list_index"] = params["list_index"]
				this_json["type"] = params["type"]
				this_json["title"] = source_json.get("title")
				this_json["source_url"] = source_json.get("source_url")
				this_json["publisher_url"] = source_json.get("publisher_url")
				if (source_json.get("stripped_html") != None):
					this_json["stripped_html_HTML"] = source_json.get("stripped_html").get("HTML")
					this_json["stripped_html_source_urls"] = safelist(str, source_json.get("stripped_html").get("source_urls"))
					this_json["stripped_html_media_thumbnail_urls"] = safelist(str, source_json.get("stripped_html").get("media_thumbnail_urls"))
				this_json["time_of_publication"] = source_json.get("time_of_publication")
				this_json["arrow_links"] = source_json.get("arrow_links")
			if (mode == "google_search_side_panel_snippet"):
				this_json["base_id"] = table_properties["google_search_base"]["iterator"]
				this_json["list_index"] = params["list_index"]
				this_json["HTML"] = source_json.get("HTML")
				this_json["source_urls"] = safelist(str, source_json.get("source_urls"))
				this_json["media_thumbnail_urls"] = safelist(str, source_json.get("media_thumbnail_urls"))
			if (mode == "google_search_twitter_tweet"):
				this_json["base_id"] = table_properties["google_search_base"]["iterator"]
				this_json["list_index"] = params["list_index"]
				this_json["type"] = params["type"]
				if (source_json.get("stripped_html") != None):
					this_json["stripped_html_HTML"] = source_json.get("stripped_html").get("HTML")
					this_json["stripped_html_source_urls"] = safelist(str, source_json.get("stripped_html").get("source_urls"))
					this_json["stripped_html_media_thumbnail_urls"] = safelist(str, source_json.get("stripped_html").get("media_thumbnail_urls"))
				this_json["time_of_publication"] = source_json.get("time_of_publication")
				this_json["source_url"] = source_json.get("source_url")
			if (mode == "google_search_videobox_suggestions"):
				this_json["base_id"] = table_properties["google_search_base"]["iterator"]
				this_json["list_index"] = params["list_index"]
				this_json["source_url"] = source_json.get("source_url")
				this_json["title"] = source_json.get("title")
			if (mode == "google_search_videobox_video"):
				this_json["base_id"] = table_properties["google_search_base"]["iterator"]
				this_json["list_index"] = params["list_index"]
				this_json["title"] = source_json.get("title")
				this_json["subtitle"] = source_json.get("subtitle")
				this_json["time_of_publication"] = source_json.get("time_of_publication")
				this_json["running_time"] = safecast(int, source_json.get("running_time"))
				this_json["image_thumbnail"] = source_json.get("image_thumbnail")
				this_json["source_url"] = source_json.get("source_url")
				this_json["publisher_url"] = source_json.get("publisher_url")
				if (source_json.get("markers") != None):
					this_json["markers_image_thumbnails"] = safelist(str, source_json.get("markers"), False, "image_thumbnail")
					this_json["markers_at_seconds"] = [safecast(int, x) for x in safelist(str, source_json.get("markers"), False, "at_second")] 
					this_json["markers_titles"] = safelist(str, source_json.get("markers"), False, "title")
					this_json["markers_source_urls"] = safelist(str, source_json.get("markers"), False, "source_url")
		else:
			# Construction event
			s3_data_list.extend(insertion_google_search(source_json, "google_search_base", None, s3routine, s3uuid))
			if ((type(source_json) == dict) and (source_json.get("data") != None)):
				if ((type(source_json["data"]) == dict) and (source_json["data"].get("side_panel") != None)):
					if (source_json.get("interface") != "desktop"):
						# Mobile
						list_of_snippets = []
						if (source_json["data"]["side_panel"].get("side_panel_lower") != None):
							if (source_json["data"]["side_panel"].get("side_panel_lower").get("stripped_html_primary") != None):
								list_of_snippets.append({
									"HTML" : source_json["data"]["side_panel"].get("side_panel_lower").get("stripped_html_primary").get("HTML"),
									"media_thumbnail_urls" : source_json["data"]["side_panel"].get("side_panel_lower").get("stripped_html_primary").get("media_thumbnail_urls"),
									"source_urls" : source_json["data"]["side_panel"].get("side_panel_lower").get("stripped_html_primary").get("source_urls")
									})
							if (source_json["data"]["side_panel"].get("side_panel_lower").get("stripped_html_secondaries") != None):
								for i in range(len(source_json["data"]["side_panel"].get("side_panel_lower").get("stripped_html_secondaries"))):
									list_of_snippets.append({
									"HTML" : source_json["data"]["side_panel"].get("side_panel_lower").get("stripped_html_secondaries")[i].get("HTML"),
									"media_thumbnail_urls" : source_json["data"]["side_panel"].get("side_panel_lower").get("stripped_html_secondaries")[i].get("media_thumbnail_urls"),
									"source_urls" : source_json["data"]["side_panel"].get("side_panel_lower").get("stripped_html_secondaries")[i].get("source_urls")
									})
						for i in range(len(list_of_snippets)):
							s3_data_list.extend(insertion_google_search(list_of_snippets[i], "google_search_side_panel_snippet", {"list_index" : i}, s3routine, s3uuid))
					else:
						# Desktop
						if (source_json["data"]["side_panel"].get("stripped_htmls") != None):
							for i in range(len(source_json["data"]["side_panel"].get("stripped_htmls"))):
								s3_data_list.extend(insertion_google_search(source_json["data"]["side_panel"].get("stripped_htmls")[i], "google_search_side_panel_snippet", {"list_index" : i}, s3routine, s3uuid))
				if ((type(source_json["data"]) == dict) and (source_json["data"].get("main_panel") != None)):
					if (source_json["data"]["main_panel"].get("module_video_box") != None):
						if (source_json["data"]["main_panel"].get("module_video_box").get("video") != None):
							for i in range(len(source_json["data"]["main_panel"].get("module_video_box").get("video"))):
								s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"].get("module_video_box").get("video")[i], "google_search_videobox_video", {"list_index" : i}, s3routine, s3uuid))
					if (source_json["data"]["main_panel"].get("module_locations") != None):
						for i in range(len(source_json["data"]["main_panel"]["module_locations"])):
							s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"]["module_locations"][i], "google_search_location", {"list_index" : i}, s3routine, s3uuid))
					
					if (source_json["data"]["main_panel"].get("module_people_also_ask") != None):
						for i in range(len(source_json["data"]["main_panel"]["module_people_also_ask"])):
							s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"]["module_people_also_ask"][i], "google_search_people_also_ask_result", {"list_index" : i}, s3routine, s3uuid))
					if (source_json.get("interface") != "desktop"):
						# Mobile
						if (source_json["data"]["main_panel"].get("module_top_stories") != None):
							for i in range(len(source_json["data"]["main_panel"].get("module_top_stories"))):
								for j in range(len(source_json["data"]["main_panel"].get("module_top_stories")[i].get("tabulated_columns"))):
									s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"]["module_top_stories"][i]["tabulated_columns"][j], "google_search_news_story", {"list_index" : j, "container_index" : i, "class" : "top_story", "type" : "column"}, s3routine, s3uuid))
						
						if (source_json["data"]["main_panel"].get("module_people_also_search_for") != None):
							if (source_json["data"]["main_panel"].get("module_people_also_search_for").get("tabulated_rows") != None):
								for i in range(len(source_json["data"]["main_panel"].get("module_people_also_search_for").get("tabulated_rows"))):
									s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"].get("module_people_also_search_for").get("tabulated_rows")[i], "google_search_people_also_search_for_result", {"list_index" : i}, s3routine, s3uuid))
						
						if (source_json["data"]["main_panel"]["module_twitter"].get("column_tweets") != None):
							for i in range(len(source_json["data"]["main_panel"]["module_twitter"].get("column_tweets"))):
								s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"]["module_twitter"].get("column_tweets")[i], "google_search_twitter_tweet", {"list_index" : i, "type" : "column"}, s3routine, s3uuid))
						if (source_json["data"]["main_panel"]["module_twitter"].get("row_tweets") != None):
							for i in range(len(source_json["data"]["main_panel"]["module_twitter"].get("row_tweets"))):
								s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"]["module_twitter"].get("row_tweets")[i], "google_search_twitter_tweet", {"list_index" : i, "type" : "row"}, s3routine, s3uuid))
					else:
						# Desktop
						if (source_json["data"]["main_panel"].get("module_top_stories") != None):
							if (source_json["data"]["main_panel"].get("module_top_stories").get("tabulated_columns") != None):
								for i in range(len(source_json["data"]["main_panel"].get("module_top_stories").get("tabulated_columns"))):
									s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"]["module_top_stories"]["tabulated_columns"][i], "google_search_news_story", {"list_index" : i, "class" : "top_story", "type" : "column"}, s3routine, s3uuid))
						if (source_json["data"]["main_panel"].get("module_top_stories").get("tabulated_rows") != None):
							for i in range(len(source_json["data"]["main_panel"].get("module_top_stories").get("tabulated_rows"))):
								s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"]["module_top_stories"]["tabulated_rows"][i], "google_search_news_story", {"list_index" : i, "class" : "top_story", "type" : "row"}, s3routine, s3uuid))
						if (source_json["data"]["main_panel"].get("module_local_news").get("tabulated_columns") != None):
							for i in range(len(source_json["data"]["main_panel"].get("module_local_news").get("tabulated_columns"))):
								s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"]["module_local_news"]["tabulated_columns"][i], "google_search_news_story", {"list_index" : i, "class" : "local_news", "type" : "column"}, s3routine, s3uuid))
						if (source_json["data"]["main_panel"]["module_related_searches"].get("carousels") != None):
							for i in range(len(source_json["data"]["main_panel"]["module_related_searches"].get("carousels"))):
								if (source_json["data"]["main_panel"]["module_related_searches"].get("carousels")[i].get("cards") != None):
									for j in range(len(source_json["data"]["main_panel"]["module_related_searches"].get("carousels")[i].get("cards"))):
										s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"]["module_related_searches"].get("carousels")[i].get("cards")[j], "google_search_related_searches_carousel_card", {"list_index" : j, "carousel_index" : i}, s3routine, s3uuid))
						if (source_json["data"]["main_panel"]["module_twitter"].get("tweets") != None):
							for i in range(len(source_json["data"]["main_panel"]["module_twitter"].get("tweets"))):
								s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"]["module_twitter"].get("tweets")[i], "google_search_twitter_tweet", {"list_index" : i, "type" : "column"}, s3routine, s3uuid))
						if (source_json["data"]["main_panel"]["module_video_box"].get("suggestions") != None):
							for i in range(len(source_json["data"]["main_panel"]["module_video_box"].get("suggestions"))):
								s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"]["module_video_box"].get("suggestions")[i], "google_search_videobox_suggestions", {"list_index" : i}, s3routine, s3uuid))
					if (source_json["data"]["main_panel"].get("search_results") != None):
						for i in range(len(source_json["data"]["main_panel"].get("search_results").get("results_promoted_upper"))):
							s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"].get("search_results").get("results_promoted_upper")[i], "google_search_result", {"list_index" : i, "type" : "promoted_upper"}, s3routine, s3uuid))
						for i in range(len(source_json["data"]["main_panel"].get("search_results").get("results_promoted_lower"))):
							s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"].get("search_results").get("results_promoted_lower")[i], "google_search_result", {"list_index" : i, "type" : "promoted_lower"}, s3routine, s3uuid))
						for i in range(len(source_json["data"]["main_panel"].get("search_results").get("results_snippets"))):
							s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"].get("search_results").get("results_snippets")[i], "google_search_result", {"list_index" : i, "type" : "snippet"}, s3routine, s3uuid))
						for i in range(len(source_json["data"]["main_panel"].get("search_results").get("results_nonpromoted"))):
							s3_data_list.extend(insertion_google_search(source_json["data"]["main_panel"].get("search_results").get("results_nonpromoted")[i], "google_search_result", {"list_index" : i, "type" : "standard"}, s3routine, s3uuid))
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
		