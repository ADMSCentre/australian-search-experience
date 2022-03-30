#!/bin/bash
mkdir upload
rsync -av . ./upload --exclude="env" --exclude="upload"
pip freeze > requirements.txt --no-cache-dir
pip install -r requirements.txt -t ./upload --no-cache-dir
cd upload
zip -r upload.zip *
aws lambda update-function-code --function-name arn:aws:lambda:us-east-2:519969025508:function:aw-datenspende-pull --zip-file fileb://upload.zip
cd ..
rm -r upload
rm ./requirements.txt