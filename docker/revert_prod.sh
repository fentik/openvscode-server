#
# Simple script to revert the 'latest' tag in production to a different image.
#
# Usage:
#       revert_prod.sh <IMAGE_TAG>
#   where image_tag is the tag (typically SHA) of the image in AWS ECR
#

IMAGE_TAG=$1

if [ ! $IMAGE_TAG ]; then
	echo "Please specify tag you want to revert prod to"
	exit
fi

MANIFEST=$(aws ecr batch-get-image --region us-east-1 --repository-name prod-dataflo-ide-server --image-ids imageTag=$IMAGE_TAG --output json | jq --raw-output --join-output '.images[0].imageManifest')

aws ecr put-image --region us-east-1 --repository-name prod-dataflo-ide-server --image-tag x86_64-latest --image-manifest "$MANIFEST"
