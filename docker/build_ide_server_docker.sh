#!/bin/bash

# Builds dataflo-ide-server docker.

#
# To build production docker (Should be run on a Linux box)
#      build_ide_server_docker.sh --prod
#
# To build a dev docker image (Builds a Linux or Mac (arm64) build depending on where you run it)
#      build_ide_server_docker.sh --dev
#

set -e

ECR_HOST="460511261886.dkr.ecr.us-east-1.amazonaws.com"
ECR_REPOSITORY="dev-dataflo-ide-server"
GIT_BRANCH='fentik'
ECR_REGION='us-east-1'
DEPLOY_ENV='dev'

PLATFORM=`uname -m`

if [ "$PLATFORM" == "x86_64" ]; then
    BUILDARCH='linux-x64'
elif [ "$PLATFORM" == "arm64" ]; then
    BUILDARCH='linux-arm64'
fi

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
        --ci)
            LOCAL="TRUE"
            DEPLOY_ENV="dev"
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

if [ ! $LOCAL ] && [ ! $CI ]; then
    TMP_DIR=$(mktemp -d)
    echo "Using $TMP_DIR to build docker image..."
    cd $TMP_DIR
    git clone -b $GIT_BRANCH git@github.com:fentik/openvscode-server.git
    cd openvscode-server
    GIT_SHA=$(git rev-parse $GIT_BRANCH)
else
    echo "Building docker image from local repo assuming the script was run from local openvscode-server repo..."
    GIT_SHA=$(git rev-parse HEAD)
fi

# Login to ECR.
aws ecr get-login-password --region $ECR_REGION | docker login --username AWS --password-stdin $ECR_HOST
echo "Building docker image for $BUILDARCH with git sha $GIT_SHA (Tag: $ECR_REPO_FQN:$PLATFORM-latest)"
docker build -t "$ECR_REPO_FQN:$PLATFORM-$GIT_SHA" -t "$ECR_REPO_FQN:$PLATFORM-latest" --build-arg "BUILDARCH=$BUILDARCH" -f "$DOCKER_FILE_PATH" .

if [ $CI ]; then
    # Push the dev image.
    docker push -a "$ECR_REPO_FQN"
    # Now also build the prod image and push it.  Without the latest tag, until we start pegging versions.
    ECR_REPOSITORY="prod-dataflo-ide-server"
    ECR_REPO_FQN="$ECR_HOST/$ECR_REPOSITORY"
    docker build -t "$ECR_REPO_FQN:$PLATFORM-$GIT_SHA" --build-arg "BUILDARCH=$BUILDARCH" -f "$DOCKER_FILE_PATH" .
    docker push -a "$ECR_REPO_FQN"

elif [ ! $NO_PUSH ] && [ ! $LOCAL ]; then
    docker push -a "$ECR_REPO_FQN"
else
    echo "Not pushing the docker image to ECR because either --no-push or --local was passed as a flag."
fi

# Clean up old (now untagged) images.
docker system prune --force
