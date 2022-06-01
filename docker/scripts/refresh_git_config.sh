# Export the environment variables needed by the python script.
source $HOME/.bashrc

REPO_DIR=$HOME/repo/$REPO_NAME
echo "Refreshing git tokens for repo at $REPO_DIR."
cd $REPO_DIR
/usr/bin/python3 /opt/dataflo/python/ops/docker/refresh_git_config.py
