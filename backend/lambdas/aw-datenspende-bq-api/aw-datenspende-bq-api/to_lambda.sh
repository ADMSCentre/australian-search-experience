#!/bin/bash
#sudo bash to_lambda.sh
cp -r ../schemas ./schemas
cp ../run.py ./run.py
cp ../creds.json ./creds.json
cp ../schema_statistics.json ./schema_statistics.json
cp ../construct_youtube.py ./construct_youtube.py
cp ../construct_google_news.py ./construct_google_news.py
cp ../construct_google_videos.py ./construct_google_videos.py
cp ../construct_google_search.py ./construct_google_search.py
cp ../construct_user.py ./construct_user.py
cp ../utils.py ./utils.py

mkdir to_lambda
rsync -av . ./to_lambda --exclude="env" --exclude="to_lambda"
cd to_lambda
zip -r to_lambda.zip *

aws lambda update-function-code --function-name arn:aws:lambda:us-east-2:519969025508:function:aw-datenspende-bq-api-v2 --zip-file fileb://to_lambda.zip
cd ..
rm -r ./schemas
rm ./schema_statistics.json
rm ./creds.json
rm ./construct_youtube.py
rm ./construct_google_news.py
rm ./construct_google_videos.py
rm ./construct_google_search.py
rm ./construct_user.py
rm ./utils.py
rm ./run.py
rm -r to_lambda


