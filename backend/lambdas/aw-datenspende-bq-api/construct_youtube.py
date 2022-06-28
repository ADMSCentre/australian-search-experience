'''
	This is an extended utilities file for all functionality related to the data storage 
	process of data from the 'Youtube' platform
'''

from utils import *
import traceback
import uuid

table_properties = get_table_properties()


'''
	This function determines whether the compact result object exists in the Youtube result
'''
def compact_result_object_exists(data):
	if (safeget(data,["compact_result_object"]) != None):
		if (type(safeget(data,["compact_result_object"])) == dict):
			return True
		else:
			return False
	else:
		return False


def insertion_youtube(source_json, mode=None, params=None, s3routine=False, s3uuid=None):
	s3_data_list = []
	base_url = "https://www.youtube.com/results?search_query=DYNAMIC_OPTIONS_KEYWORD"
	try:
		if (mode != None):
			this_json = dict()
			bigquery_uuid = str(uuid.uuid4())
			table_properties[mode]["iterator"] = bigquery_uuid
			this_json["id"] = table_properties[mode]["iterator"]
			if (mode == "youtube_base"):
				# Add the connecting details that link the Google BigQuery entries to the S3 records
				s3_data_list.append({ "mode": "s3_bigquery", "json" : { "s3" : s3uuid, "bigquery" : bigquery_uuid, "type" : "youtube" }})
				# Base details
				this_json["version"] = safecast(int,safeget(source_json,["version"]).replace(".", "")) 
				this_json["hash_key"] = safeget(source_json,["hash_key"])
				this_json["user_agent"] = safeget(source_json,["user_agent"])
				this_json["browser_type"] = safeget(source_json,["browser"])
				this_json["keyword"] = safeget(source_json,["keyword"])
				this_json["machine_type"] = safeget(source_json,["interface"])
				this_json["search_platform"] = safeget(source_json,["platform"])
				this_json["plugin_id"] = safeget(source_json,["plugin_id"])
				this_json["time_of_retrieval"] = datetime_from_timestamp(safeget(source_json,["time_of_retrieval"]))
				this_json["localisation"] = safeget(source_json,["localisation"])
				base_url = base_url.replace("DYNAMIC_OPTIONS_KEYWORD", urllib.parse.quote_plus(str(source_json.get("keyword"))))
				base_url = base_url.replace("DYNAMIC_NAVIGATOR_LANGUAGE", source_json.get("localisation"))
				this_json["url"] = base_url#.replace("DYNAMIC_OPTIONS_KEYWORD", urllib.parse.quote_plus(str(safeget(source_json,["keyword"]))))
				# If there is data in this JSON object
				if ((type(source_json) == dict) and (safeget(source_json,["data"]) != None) and (type(safeget(source_json,["data"]) == dict))):
					data = source_json.get("data")
					this_json["logged_in"] = True if (safeget(data,["logged_in"])) else False
					this_json["compact_result_object_exists"] = compact_result_object_exists(data)
					if (this_json["compact_result_object_exists"]):
						compact_ro = safeget(data,["compact_result_object"])
						this_json["compact_result_object_title"] = safeget(compact_ro,["title"])
						this_json["compact_result_object_subtitle"] = safeget(compact_ro,["subtitle"])
						this_json["compact_result_object_badge_paid_item"] = safecast(bool, safeget(compact_ro,["badge_paid_item"]))
						this_json["compact_result_object_image_thumbnail"] = safeget(compact_ro,["image_thumbnail"])
						this_json["compact_result_object_image_set"] = safelist(str, safeget(compact_ro,["image_set"]), True)
						this_json["compact_result_object_call_to_action_button_title"] = safeget(compact_ro,["call_to_action_button_title"])
						this_json["compact_result_object_call_to_action_button_url"] = safeget(compact_ro,["call_to_action_button_url"])
						compact_ro_cards = safeget(compact_ro,["tabulated_cards"])
						if (compact_ro_cards != None):
							this_json["compact_result_object_tabulated_card_image_thumbnails"] = safelist(str, compact_ro_cards, False, "image_thumbnail")
							this_json["compact_result_object_tabulated_card_titles"] = safelist(str, compact_ro_cards, False, "title")
							this_json["compact_result_object_tabulated_card_source_urls"] = safelist(str, compact_ro_cards, False, "source_url")
						compact_ro_results = safeget(compact_ro,["tabulated_results"])
						if (compact_ro_results != None):
							this_json["compact_result_object_tabulated_result_titles"] = safelist(str, compact_ro_results, False, "title")
							if (source_json.get("interface") == "desktop"):
								this_json["compact_result_object_tabulated_result_subtitle_volatile_time_of_publication"] = safelist(str, compact_ro_results, False, ["subtitle","volatile_time_of_publication"])
								this_json["compact_result_object_tabulated_result_subtitle_volatile_number_of_views"] = safelist(int, compact_ro_results, False, ["subtitle","volatile_number_of_views"])
							this_json["compact_result_object_tabulated_result_source_urls"] = safelist(str, compact_ro_results, False, "source_url")
							this_json["compact_result_object_tabulated_result_running_times"] = safelist(int, compact_ro_results, False, "running_time")
						this_json["compact_result_object_dropdown_exists"] = (source_json.get("interface") == "desktop")
						this_json["order_of_results"] = safelist(str, safeget(data,["order_of_results"]), False)
					this_json["tabulated_shelves_titles"] = safelist(str, safeget(data,["tabulated_shelves"]), False, "title")
					compact_show_header = safeget(data,["compact_show_header"])
					if (compact_show_header != None):
						this_json["compact_show_header_title"] = safeget(compact_show_header,["title"])
						this_json["compact_show_header_image_thumbnail"] = safeget(compact_show_header,["image_thumbnail"])
					tabulated_people_also_search_for = safeget(data,["tabulated_people_also_search_for"])
					if (tabulated_people_also_search_for != None):
						this_json["tabulated_people_also_search_for_image_thumbnails"] = safelist(str, tabulated_people_also_search_for, False, "image_thumbnail")
						this_json["tabulated_people_also_search_for_titles"] = safelist(str, tabulated_people_also_search_for, False, "title")
						this_json["tabulated_people_also_search_for_link_urls"] = safelist(str, tabulated_people_also_search_for, False, "link_url")
			elif (mode == "youtube_channel"):
				this_json["base_id"] = table_properties["youtube_base"]["iterator"]
				this_json["list_index"] = params["list_index"]
				this_json["publisher"] = safeget(source_json,["publisher"])
				this_json["image_thumbnail"] = safeget(source_json,["image_thumbnail"])
				this_json["publisher_verified"] = safecast(bool, safeget(source_json,["publisher_verified"]))
				this_json["number_of_subscribers"] = safecast(int, safeget(source_json,["number_of_subscribers"]))
				this_json["number_of_published_videos"] = safecast(int, safeget(source_json,["number_of_published_videos"]))
				this_json["text"] = safeget(source_json,["text"])
			elif (mode == "youtube_movie"):
				this_json["base_id"] = table_properties["youtube_base"]["iterator"]
				this_json["list_index"] = params["list_index"]
				this_json["title"] = safeget(source_json,["title"])
				this_json["metadata_a"] = safeget(source_json,["metadata_a"])
				this_json["metadata_b"] = safeget(source_json,["metadata_b"])
				this_json["source_url"] = safeget(source_json,["source_url"])
				this_json["publisher"] = safeget(source_json,["publisher"])
				this_json["running_time"] = safecast(int, safeget(source_json,["running_time"]))
				this_json["time_of_publication"] = safeget(source_json,["time_of_publication"])
				this_json["image_thumbnail"] = safeget(source_json,["image_thumbnail"])
				this_json["number_of_views"] = safecast(int, safeget(source_json,["number_of_views"]))
				this_json["byline"] = safeget(source_json,["byline"])
				this_json["publisher_verified"] = safecast(bool, safeget(source_json,["publisher_verified"]))
				this_json["badge_closed_captions"] = safecast(bool, safeget(source_json,["badge_closed_captions"]))
				this_json["badge_new_video"] = safecast(bool, safeget(source_json,["badge_new_video"]))
				this_json["badge_4k_resolution"] = safecast(bool, safeget(source_json,["badge_4k_resolution"]))
				this_json["badge_artist"] = safecast(bool, safeget(source_json,["badge_artist"]))
			elif (mode == "youtube_playlist"):
				this_json["base_id"] = table_properties["youtube_base"]["iterator"]
				this_json["list_index"] = params["list_index"]
				this_json["title"] = safeget(source_json,["title"])
				this_json["source_url"] = safeget(source_json,["source_url"])
				this_json["publisher"] = safeget(source_json,["publisher"])
				this_json["publisher_url"] = safeget(source_json,["publisher_url"])
				this_json["image_thumbnail"] = safeget(source_json,["image_thumbnail"])
				this_json["time_of_publication"] = safeget(source_json,["time_of_publication"])
				this_json["number_of_videos"] = safecast(int, safeget(source_json,["number_of_videos"]))
				this_json["playlist_showcase_items_titles"] = safelist(str, safeget(source_json,["playlist_showcase_items"]), False, "title")
				this_json["playlist_showcase_items_source_urls"] = safelist(str, safeget(source_json,["playlist_showcase_items"]), False, "source_url")
				this_json["playlist_showcase_items_running_times"] = safelist(int, safeget(source_json,["playlist_showcase_items"]), False, "running_time")
			elif (mode == "youtube_promoted_result"):
				this_json["base_id"] = table_properties["youtube_base"]["iterator"]
				this_json["list_index"] = params["list_index"]
				this_json["type"] = params["type"]
				this_json["title"] = safeget(source_json,["title"])
				if (params["interface"] == "desktop"):
					if (params["type"] == "over_results"):
						this_json["sub_text_a"] = safeget(source_json,["text"])
					elif (params["type"] == "top_shelf"):
						this_json["sub_text_a"] = safeget(source_json,["sub_text_a"])
					elif (params["type"] == "in_results"):
						this_json["sub_text_a"] = safeget(source_json,["text"])
				else:
					this_json["sub_text_a"] = safeget(source_json,["text"])
				this_json["sub_text_b"] = safeget(source_json,["sub_text_b"])
				if (params["interface"] == "desktop"):
					if (params["type"] == "over_results"):
						this_json["source_url"] = safeget(source_json,["website_url"])
					elif (params["type"] == "top_shelf"):
						this_json["source_url"] = safeget(source_json,["link_url"])
					elif (params["type"] == "in_results"):
						this_json["source_url"] = safeget(source_json,["source_url"])
				else:
					this_json["source_url"] = safeget(source_json,["website_url"])
				this_json["call_to_action_button_title"] = safeget(source_json,["call_to_action_button_title"])
				this_json["call_to_action_button_url"] = safeget(source_json,["call_to_action_button_url"])
				this_json["links_list_titles"] = safelist(str, safeget(source_json,["links_list_titles"]), False)
				this_json["links_list_urls"] = safelist(str, safeget(source_json,["links_list_urls"]), False)
				this_json["publisher"] = safeget(source_json,["publisher"])
				this_json["publisher_url"] = safeget(source_json,["publisher_url"])
				this_json["time_of_publication"] = safeget(source_json,["time_of_publication"])
				this_json["running_time"] = safecast(int, safeget(source_json,["running_time"]))
				this_json["image_thumbnail"] = safeget(source_json,["image_thumbnail"])
				this_json["number_of_views"] = safecast(int, safeget(source_json,["number_of_views"]))
				this_json["publisher_verified"] = safecast(bool, safeget(source_json,["publisher_verified"]))
				this_json["badge_closed_captions"] = safecast(bool, safeget(source_json,["badge_closed_captions"]))
				this_json["badge_4k_resolution"] = safecast(bool, safeget(source_json,["badge_4k_resolution"]))
				this_json["badge_new_video"] = safecast(bool, safeget(source_json,["badge_new_video"]))
				this_json["badge_artist"] = safecast(bool, safeget(source_json,["badge_artist"]))
			elif (mode == "youtube_video"):
				this_json["base_id"] = table_properties["youtube_base"]["iterator"]
				this_json["list_index"] = params["list_index"]
				this_json["title"] = safeget(source_json,["title"])
				this_json["text"] = safeget(source_json,["text"])
				this_json["publisher"] = safeget(source_json,["publisher"])
				this_json["publisher_url"] = safeget(source_json,["publisher_url"])
				this_json["time_of_publication"] = safeget(source_json,["time_of_publication"])
				this_json["source_url"] = safeget(source_json,["source_url"])
				this_json["running_time"] = safecast(int, safeget(source_json,["running_time"]))
				this_json["image_thumbnail"] = safeget(source_json,["image_thumbnail"])
				this_json["number_of_views"] = safecast(int, safeget(source_json,["number_of_views"]))
				this_json["publisher_verified"] = safecast(bool, safeget(source_json,["publisher_verified"]))
				this_json["badge_closed_captions"] = safecast(bool, safeget(source_json,["badge_closed_captions"]))
				this_json["badge_new_video"] = safecast(bool, safeget(source_json,["badge_new_video"]))
				this_json["badge_4k_resolution"] = safecast(bool, safeget(source_json,["badge_4k_resolution"]))
				this_json["badge_artist"] = safecast(bool, safeget(source_json,["badge_artist"]))
			elif (mode == "youtube_dropdown"):
				this_json["base_id"] = table_properties["youtube_base"]["iterator"]
				this_json["list_index"] = params["list_index"]
				this_json["dropdown_titles"] = safelist(str, safeget(source_json,["title_list"]))
				this_json["dropdown_subtitles"] = safelist(str, safeget(source_json,["subtitle_list"]))
			
		else:
			# Construction event
			s3_data_list.extend(insertion_youtube(source_json, "youtube_base", None, s3routine, s3uuid))

			# Youtube channels
			tabulated_channels = safeget(source_json,["data","tabulated_channels"])
			if (tabulated_channels != None) and (type(tabulated_channels) == list):
				for i in range(len(tabulated_channels)):
					s3_data_list.extend(insertion_youtube(tabulated_channels[i], "youtube_channel", {"list_index" : i}, s3routine, s3uuid))

			# Youtube movie
			tabulated_movies = safeget(source_json,["data","tabulated_movies"])
			if (tabulated_movies != None) and (type(tabulated_movies) == list):
				for i in range(len(tabulated_movies)):
					s3_data_list.extend(insertion_youtube(tabulated_movies[i], "youtube_movie", {"list_index" : i}, s3routine, s3uuid))

			# Youtube playlist
			tabulated_playlists = safeget(source_json,["data","tabulated_playlists"])
			if (tabulated_playlists != None) and (type(tabulated_playlists) == list):
				for i in range(len(tabulated_playlists)):
					s3_data_list.extend(insertion_youtube(tabulated_playlists[i], "youtube_playlist", {"list_index" : i}, s3routine, s3uuid))

			# Youtube promoted result
			tabulated_promotions_in_results = safeget(source_json,["data","tabulated_promotions_in_results"])
			interface = safeget(source_json,["interface"])
			if (tabulated_promotions_in_results != None) and (type(tabulated_promotions_in_results) == list):
				for i in range(len(tabulated_promotions_in_results)):
					s3_data_list.extend(insertion_youtube(tabulated_promotions_in_results[i], "youtube_promoted_result", {"list_index" : i, "type" : "in_results", "interface" : interface}, s3routine, s3uuid))

			tabulated_promotions_over_results = safeget(source_json,["data","tabulated_promotions_over_results"])
			if (tabulated_promotions_over_results != None) and (type(tabulated_promotions_over_results) == list):
				for i in range(len(tabulated_promotions_over_results)):
					s3_data_list.extend(insertion_youtube(tabulated_promotions_over_results[i], "youtube_promoted_result", {"list_index" : i, "type" : "over_results", "interface" : interface}, s3routine, s3uuid))

			tabulated_promotions_top_shelf = safeget(source_json,["data","tabulated_promotions_top_shelf"])
			if (tabulated_promotions_top_shelf != None) and (type(tabulated_promotions_top_shelf) == list):
				for i in range(len(tabulated_promotions_top_shelf)):
					s3_data_list.extend(insertion_youtube(tabulated_promotions_top_shelf[i], "youtube_promoted_result", {"list_index" : i, "type" : "top_shelf", "interface" : interface}, s3routine, s3uuid))

			# Youtube compact result object dropdowns
			tabulated_compact_result_object_dropdowns = safeget(source_json,["data","compact_result_object","tabulated_dropdowns"])
			if (tabulated_compact_result_object_dropdowns != None) and (type(tabulated_compact_result_object_dropdowns) == list):
				for i in range(len(tabulated_compact_result_object_dropdowns)):
					s3_data_list.extend(insertion_youtube(tabulated_compact_result_object_dropdowns[i], "youtube_dropdown", {"list_index" : i}, s3routine, s3uuid))

			# Youtube video
			tabulated_videos = safeget(source_json,["data","tabulated_videos"])
			if (tabulated_videos != None) and (type(tabulated_videos) == list):
				for i in range(len(tabulated_videos)):
					s3_data_list.extend(insertion_youtube(tabulated_videos[i], "youtube_video", {"list_index" : i}, s3routine, s3uuid))
			tabulated_results = safeget(source_json,["data","tabulated_results"])
			if (tabulated_results != None) and (type(tabulated_results) == list):
				for i in range(len(tabulated_results)):
					s3_data_list.extend(insertion_youtube(tabulated_results[i], "youtube_video", {"list_index" : i}, s3routine, s3uuid))
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
		