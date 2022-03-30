'''
	This is an extended utilities file for all functionality related to the data storage 
	process of data from the users themselves
'''

from utils import *
import traceback
import uuid

table_properties = get_table_properties()

def insertion_user(source_json, mode=None, s3routine=False):
	s3_data_list = []
	try:
		if (mode != None):
			this_json = dict()
			table_properties[mode]["iterator"] = str(uuid.uuid4())
			this_json["id"] = table_properties[mode]["iterator"]
			if (mode == "user"):

				gender_backmap = { 
					"m" : "Male", 
					"f" : "Female", 
					"o" : "Other", 
					"n" : "Prefer not to say" 
				}
				age_backmap = { 
					"1" : "18 - 24", 
					"2" : "25 - 34", 
					"3" : "35 - 44",
					"4" : "45 - 54",
					"5" : "55 - 64",
					"6" : "65 - 74",
					"7" : "75 and over",
					"n" : "Prefer not to say"
				}
				income_bracket_backmap = {
					"1" : "$1 - $15,599",
					"2" : "$15,600 - $20,799",
					"3" : "$20,800 - $25,999",
					"4" : "$26,000 - $33,799",
					"5" : "$33,800 - $41,599",
					"6" : "$41,600 - $51,999",
					"7" : "$52,000 - $64,999",
					"8" : "$65,000 - $77,999",
					"9" : "$78,000 - $90,999",
					"10" : "$91,000 - $103,999",
					"11" : "$104,000 - $155,999",
					"12" : "$156,000 or more",
					"n" : "Prefer not to say"
				}

				level_education_backmap = {
					"12l" : "Less than year 12 or equivalent",
					"12" : "Year 12 or equivalent",
					"b" : "Bachelor degree level",
					"p" : "Postgraduate degree level",
					"n" : "Prefer not to say"
				}

				language_backmap = {
					"en" : "English",
					"ma" : "Mandarin",
					"ar" : "Arabic",
					"ca" : "Cantonese",
					"vi" : "Vietnamese",
					"it" : "Italian",
					"gr" : "Greek",
					"fi" : "Filipino / Tagalog",
					"hi" : "Hindi",
					"sp" : "Spanish",
					"pu" : "Punjabi",
					"pe" : "Persian / Dari / Hazaraghi",
					"ko" : "Korean",
					"ge" : "German",
					"ta" : "Tamil",
					"o" : "Other",
					"n" : "Prefer not to say"
				}

				employment_status_backmap = {
					"1" : "Employed full-time",
					"2" : "Employed part-time",
					"3" : "Unemployed and looking for work",
					"4" : "Unemployed and not looking for work",
					"5" : "Retired",
					"n" : "Prefer not to say"
				}

				party_preference_backmap = {
					"li" : "Liberal",
					"na" : "National",
					"la" : "Labor",
					"gn" : "Greens",
					"on" : "One Nation",
					"ot" : "Other",
					"nn" : "None",
					"ns" : "Prefer not to say",
				}

				this_json["gender"] = safeget(gender_backmap, [safeget(source_json,["gender"])])
				this_json["age"] = safeget(age_backmap, [safeget(source_json,["age"])])
				this_json["income_bracket"] = safeget(income_bracket_backmap, [safeget(source_json,["income_bracket"])])
				this_json["level_education"] = safeget(level_education_backmap, [safeget(source_json,["level_education"])])
				this_json["language"] = safeget(language_backmap, [safeget(source_json,["language"])])
				this_json["employment_status"] = safeget(employment_status_backmap, [safeget(source_json,["employment_status"])])
				this_json["party_preference"] = safeget(party_preference_backmap, [safeget(source_json,["party_preference"])])
				this_json["gender_specify"] = safeget(source_json,["gender_specify"])
				this_json["postcode"] = safeget(source_json,["postcode"])
				this_json["language_specify"] = safeget(source_json,["language_specify"])
				this_json["party_preference_specify"] = safeget(source_json,["party_preference_specify"])
				this_json["created_at"] = safecast(int, safeget(source_json,["createdAt"]))
				this_json["activation_code"] = safeget(source_json,["hashKey"])
		else:
			# Construction event
			s3_data_list.extend(insertion_user(source_json, "user", s3routine))

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







