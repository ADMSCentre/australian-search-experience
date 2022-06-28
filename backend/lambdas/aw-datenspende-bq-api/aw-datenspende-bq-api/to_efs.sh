
sudo rm -r to_efs
mkdir to_efs
pip freeze > requirements.txt --no-cache-dir
pip install -r requirements.txt -t ./to_efs --no-cache-dir

# The following commented out commands are applied manually 
# (and rarely onto the associated EFS as necessary, since dependencies are not regularly updated)

#ssh -i "~/.ssh/fta_key_2.pem" ec2-user@3.22.248.111
#sudo chown ec2-user:ec2-user /efs
# Make sure the folder is empty first
#sudo rm -r /efs/*
#exit


#rsync -avL --progress -e "ssh -i ~/.ssh/fta_key_2.pem" ~/dev/2021/1_datenspende/australian-search-experience/backend/lambdas/aw-datenspende-bq-api/aw-datenspende-bq-api/to_efs/* ec2-user@3.22.248.111:/efs

#ssh -i "~/.ssh/fta_key_2.pem" ec2-user@3.22.248.111
#sudo chown -R 1001:1001 /efs
#exit

#sudo rm -r to_efs

sudo mount -t nfs -o nfsvers=4.1,rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2,noresvport fs-0b42839fb58bbd2f6.efs.us-east-2.amazonaws.com:/   ~/efs-mount-point  
sudo mount -t nfs4 -o nfsvers=4.1,rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2,noresvport fs-0b42839fb58bbd2f6.efs.us-east-2.amazonaws.com:/ efs