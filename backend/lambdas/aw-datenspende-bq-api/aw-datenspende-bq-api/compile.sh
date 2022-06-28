#!/bin/bash
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

mkdir upload
rsync -av . ./upload --exclude="env" --exclude="upload"
pip freeze > requirements.txt --no-cache-dir
pip install -r requirements.txt -t ./upload --no-cache-dir
cd upload
zip -r upload.zip *


cd upload
aws s3 cp upload.zip s3://aw-datenspende-bucket/upload-aw-datenspende-bq-api.zip

aws lambda update-function-code --function-name arn:aws:lambda:us-east-2:519969025508:function:aw-datenspende-bq-api --s3-bucket aw-datenspende-bucket --s3-key upload-aw-datenspende-bq-api.zip

#aws lambda update-function-code --function-name arn:aws:lambda:us-east-2:519969025508:function:aw-datenspende-bq-api --zip-file fileb://upload.zip
#cd ..
#rm -r ./schemas
#rm ./schema_statistics.json
#rm ./creds.json
#rm ./construct_youtube.py
#rm ./construct_google_news.py
#rm ./construct_google_videos.py
#rm ./construct_google_search.py
#rm ./construct_user.py
#rm ./requirements.txt
#rm ./utils.py
#rm ./run.py
#rm -r upload

# turn on the instance
# mount the efs
# change ownership
# scp
# change ownership
# close
