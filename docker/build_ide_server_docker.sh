#!/bin/bash

# Builds dataflo-ide-server docker.

set -e

ECR_HOST="460511261886.dkr.ecr.us-east-1.amazonaws.com"
ECR_REPOSITORY="dev-dataflo-ide-server"
GIT_BRANCH='fentik'
ECR_REGION='us-east-1'
DEPLOY_ENV='dev'

while :; do
    case $1 in
        --prod)
            DEPLOY_ENV="prod"
            ;;
        --dev)
            DEPLOY_ENV="dev"
            ;;
        --no-push)
            NO_PUSH='TRUE'
            ;;
        --local)
            LOCAL='TRUE'
            ;;
        *)
            break
    esac
    shift
done

if [ $DEPLOY_ENV == "prod" ]; then
    ECR_REPOSITORY="prod-dataflo-ide-server"
fi


ECR_REPO_FQN="$ECR_HOST/$ECR_REPOSITORY"
DOCKER_FILE_PATH="docker/Dockerfile"

PLATFORM=`uname -m`

case $PLATFORM in
    x86_64)
	BUILDARCH='x64'
	;;
    *)
	BUILDARCH=$PLATFORM
	;;
esac

if [ ! $LOCAL ]; then
    TMP_DIR=$(mktemp -d)
    echo "Using $TMP_DIR to build docker image..."
    cd $TMP_DIR
    git clone -b $GIT_BRANCH git@github.com:fentik/openvscode-server.git
    cd openvscode-server
else
    echo "Building docker image from local repo assuming the script was run from dataflo/python..."
fi

GIT_SHA=$(git rev-parse $GIT_BRANCH)
# Login to ECR.
aws ecr get-login-password --region $ECR_REGION|docker login --username AWS --password-stdin $ECR_HOST
docker build -t "$ECR_REPO_FQN:$GIT_SHA"  -t "$ECR_REPO_FQN:$PLATFORM-latest" --build-arg BUILDARCH=$BUILDARCH -f "$DOCKER_FILE_PATH" .

if [ ! $NO_PUSH ] && [ ! $LOCAL ]; then
    docker push -a "$ECR_REPO_FQN"
else
    echo "Not pushing the docker image to ECR because either --no-push or --local was passed as a flag."
fi

# Clean up old (now untagged) images.
docker system prune --force
