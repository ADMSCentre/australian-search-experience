#!/bin/bash
zip -r upload.zip * -x compile.sh
aws lambda update-function-code --function-name arn:aws:lambda:us-east-2:519969025508:function:aw-datenspende-api --zip-file fileb://upload.zip
rm upload.zip


