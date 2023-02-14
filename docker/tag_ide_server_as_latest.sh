#!/bin/bash
#
# Tag a prod-dataflo-ide-server image as latest (so it will be used in production).

set -eux

IMAGE_TAG="$1"

MANIFEST=$(aws ecr batch-get-image --repository-name prod-dataflo-ide-server --image-ids imageTag=$IMAGE_TAG --region us-east-1 --query images[].imageManifest --output text)
aws ecr put-image --repository-name prod-dataflo-ide-server --image-tag x86_64-latest --image-manifest "$MANIFEST" --region us-east-1
