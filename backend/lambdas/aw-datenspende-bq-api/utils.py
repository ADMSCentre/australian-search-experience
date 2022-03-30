import os
from os import listdir
from os.path import isfile, join, realpath, dirname
import datetime
import json
import urllib.parse

'''
	Get all files in a given folder path
'''
def files_in_folder(folder_fname):
	return [f for f in listdir(folder_fname) if isfile(join(folder_fname, f)) and f != ".DS_Store"]

CONST_TEMP_JSON_FOLDER_NAME = "tmp_json"
CONST_TABLE_SCHEMA_FILES = files_in_folder(join(os.getcwd(), "schemas"))
CONSTANT_TABLE_IDS = ([x.replace("schema_", "").replace(".json", "") for x in CONST_TABLE_SCHEMA_FILES])

'''
	Generate table record properties for row creation
	NB: It also generates all iterators for all schemas (necessary for IDs)
'''
def get_table_properties():
	table_properties = dict()
	for table in CONSTANT_TABLE_IDS:
		table_properties[table] = { "iterator" : -1 }
	return table_properties

'''
	Creates a datetime string from an integer
'''
def datetime_from_timestamp(timestamp):
	rtn = None
	if (timestamp != None):
		rtn = datetime.datetime.fromtimestamp(int(timestamp)).strftime('%Y-%m-%d %H:%M:%S')
	return rtn

'''
	Attempt to cast a value or return None
'''
def safecast(caster, v):
	if (v != None):
		try:
			return caster(v)
		except:
			return None
	else:
		return None

'''
	Write a JSON record to the temporary JSON folder
'''
def write_instance(filename, source):
	f = open(join(os.getcwd(), CONST_TEMP_JSON_FOLDER_NAME, "%s.json" % (filename)), 'a')
	f.write(json.dumps(source)+'\n')
	f.close()


'''
	This function safely gets a dictionary value
'''
def safeget(v,attribute_list):
	try:
		cval = v
		for attr in attribute_list:
			cval = cval.get(attr)
		return cval
	except:
		return None

'''
	This function safely constructs a list that meets BQ's 'Array'-type standards
'''
def safelist(datatype, input_list, remove_nulls=False, field=None):
	if (input_list != None):
		null_value = None
		if   (datatype == int):
			null_value = 0
		elif (datatype == str):
			null_value = ""
		elif (datatype == float):
			null_value = 0.0
		elif (datatype == bool):
			null_value = False

		if (field == None):
			if (remove_nulls):
				return [x for x in input_list if (x != None)]
			else:
				return [x if (x != None) else null_value for x in input_list]
		else:
			if (type(field) == str):
				def null_condition(x):
					return ((x != None) and (field in x) and (x[field] != None))
				if (remove_nulls):
					return [x[field] for x in input_list if null_condition(x)]
				else:
					return [x[field] if null_condition(x) else null_value for x in input_list]
			else:
				def null_condition(x):
					return ((x != None) and (safeget(x,field) != None))
				if (remove_nulls):
					return [safeget(x,field) for x in input_list if null_condition(x)]
				else:
					return [safeget(x,field) if null_condition(x) else null_value for x in input_list]
	else:
		return []

'''
	This function removes a certain value from a list
'''
def cleanlist(input_list, wipe_field=None):
	if (len(input_list) > 0):
		if (wipe_field == None):
			return [x for x in input_list if (x != None)]
		elif (type(wipe_field) == list):
			return [x for x in input_list if (x in wipe_field)]
		else:
			return [x for x in input_list if (x != wipe_field)]
	else:
		return input_list

'''
	This function breaks a list into n parts
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
	This function evaluates JSON input row against the BQ schema defined for that row
'''
def evaluate_row_against_schema(row, json_schema):
	# This maps BigQuery types to Python types
	type_map = {
		"STRING" : str,
		"INT64" : int,
		"TIMESTAMP" : str,
		"DATETIME" : str,
		"BOOLEAN" : bool,
		"FLOAT64" : float
	}
	evaluation_passed = True
	json_row = None
	try:
		json_row = json.loads(row)
	except:
		print(row)
		return { "passed" : False, "result" : "JSON couldn't be processed %s" % (row) }
	evaluation_result = ""
	for field in json_schema:
		val = json_row.get(field["name"])
		if (field["mode"] in ["REQUIRED", "REPEATED"]):
			if (field["name"] in json_row):
				if (val == None): 
					evaluation_result = "Can't have a null value on a required or repeated field: %s" % (field["name"])
					evaluation_passed = False
				elif (field["mode"] == "REPEATED"):
					if (type(val) != list):
						evaluation_result = "A repeated field must be a list: %s" % (field["name"])
						evaluation_passed = False
					else:
						if (None in val):
							evaluation_result = "Array fields cannot have null values"
							evaluation_passed = False
						typeset = list(set([type(x) for x in val]))
						if (len(typeset) > 1):
							evaluation_result = "Can't have multiple types in one set"
							evaluation_passed = False
						elif ((len(typeset) > 0) and (typeset[0] != type_map.get(field["type"]))):
							if (type(safecast(type_map.get(field["type"]),val[0])) != type_map.get(field["type"])):
								evaluation_result = "The value must match its field type: %s" % (field["name"])
								evaluation_passed = False
			#else:
			#	evaluation_result = "Mandatory fields must exist in the row: %s" % (field["name"])
			#	evaluation_passed = False
		elif (field["mode"] != "NULLABLE"):
			if (field["name"] in json_row):
				if (val == None):
					evaluation_result = "A non-nullable field cannot be null"
					evaluation_passed = False
				elif (type(val) != type_map.get(field["type"])):
					if (type(safecast(type_map.get(field["type"]),val)) != type_map.get(field["type"])):
						evaluation_result = "The value must match its field type: %s" % (field["name"])
						evaluation_passed = False
			else:
				evaluation_result = "A non-nullable field needs to be in the row"
				evaluation_passed = False
		else:
			if (field["name"] in json_row):
				if (val != None):
					if (type(val) != type_map.get(field["type"])):
						if (type(safecast(type_map.get(field["type"]),val)) != type_map.get(field["type"])):
							evaluation_result = "The value must match its field type: %s" % (field["name"])
							evaluation_passed = False
	output = { "passed" : evaluation_passed, "result" : evaluation_result }
	if (not evaluation_passed):
		output.update({ "json" : json_row })
	return output








