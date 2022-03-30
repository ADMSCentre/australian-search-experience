import requests
import json

'''
	This is a simple python executable to test various events of the aw-datenspende-api API

	Note: Uncomment the desired code block to test the relative functionality
'''

'''
print(requests.post("https://65i9k6fick.execute-api.us-east-2.amazonaws.com/aw-datenspende-api",
	json={
	"event" : "get_table_details"
}).content)
'''


'''
print(requests.post("https://65i9k6fick.execute-api.us-east-2.amazonaws.com/aw-datenspende-api",
	json={
	"event" : "get_users",
	"afterDate" : 1628327727
}).json())
'''

'''
print(requests.post("https://65i9k6fick.execute-api.us-east-2.amazonaws.com/aw-datenspende-api",
	json={
	"event" : "register_user",
	"data" : {
		"age" : "6",
		"email_address" : "person@domain.com",
		"employment_status" : "nl",
		"ethnicity" : "o",
		"ethnicity_specify" : "Ethnicity",
		"gender" : "o",
		"gender_specify" : "asdfadf",
		"income_bracket" : "3",
		"level_education" : "v",
		"name" : "asdfnsafdfdsfds",
		"party_preference" : "o",
		"party_preference_specify" : "World Wide Web",
		"postcode" : "1234"
	}
}).content)
'''