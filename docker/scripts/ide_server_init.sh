#!/bin/bash

# Sets up the environment for the IDE server and start it up.
cat <<EOF > $HOME/.bashrc
#
# Environment variables added by Docker init script that are used by other programs.
#
export REPO_NAME=$REPO_NAME
export REPO_BRANCH_NAME=$REPO_BRANCH_NAME
export INTERNAL_SERVER_API_TOKEN=$REST_API_TOKEN
export DFCTL_API_ENDPOINT=$DFCTL_API_ENDPOINT
export DFCTL_USER_ID=$USER_ID
EOF

# Used by Theia plugin
export FENTIK_HYDRATE_QUERY_SCRIPT=/opt/dataflo/python/ops/docker/hydrate_query.py

# Set up git config
if [ ! -z $GIT_CONFIG_FIRST_NAME ] || [ ! -z $GIT_CONFIG_LAST_NAME ]
then
    git config --global user.name "$GIT_CONFIG_FIRST_NAME $GIT_CONFIG_LAST_NAME"
fi
if [ ! -z "$GIT_CONFIG_EMAIL" ]
then
    git config --global user.email "$GIT_CONFIG_EMAIL"
fi

# Make a directory to store the repo
mkdir $HOME/repo
# Clone the repo
cd $HOME/repo
if [ ! -z "$REPO_URL" ]
then
    echo "Cloning $REPO_URL"
    git clone $REPO_URL
    if [ ! -z "$REPO_BRANCH_NAME" ]
    then
        cd $REPO_NAME
        git fetch --all
        git checkout -b $REPO_BRANCH_NAME origin/$REPO_BRANCH_NAME
    fi
fi

# Start the cron daemon
/etc/init.d/cron start


git config --global core.excludesFile '~/.gitignore'
echo ".vscode" > ~/.gitignore

# post checkout hook to update current working branch
git config --global core.hooksPath ~/.git/hooks
mkdir -p ~/.git/hooks
cat <<'EOF' > ~/.git/hooks/post-checkout
#!/bin/bash
set -e

NEW_BRANCH=$(git rev-parse --abbrev-ref HEAD)
curl -s -g \
-X POST \
-H "Content-Type: application/json" \
-H "X-Auth-IDE-Auth-Token: $IDE_SERVER_USER_AUTHTOKEN" \
-H "Authorization: Token $REST_API_TOKEN" \
-d "{\"query\": \"mutation {setIdeBranch(branchName: \\\"$NEW_BRANCH\\\") { branchName } }\"}" \
$FENTIK_GRAPHQL_URI > /dev/null

EOF
chmod u+x ~/.git/hooks/post-checkout


VSCODE_WORKSPACE=$HOME/repo/$REPO_NAME

# for users migrating from theia to vscode, we want to move
# the .theia directory out of the way
if [ -d $VSCODE_WORKSPACE/.theia ]; then
	mv $VSCODE_WORKSPACE/.theia ~/theia-backup
fi

# Autoload Fentik driver so that we can run SQL queries
mkdir -p $VSCODE_WORKSPACE/.vscode
cat <<EOF > $VSCODE_WORKSPACE/.vscode/settings.json
{
    "workbench.colorTheme": "Default Light+",
    "workbench.editor.closeEmptyGroups": false,
    "workbench.editor.enablePreview": false,
	"files.watcherExclude": {
		"**/.git/**": false
	}
}
EOF

cd /opt/vscode-reh-web

# Migration: for IDEs which had the old sqltools extension installed
./bin/openvscode-server --uninstall-extension /opt/openvscode-server/binary-dependencies/sqltools-driver-fentik-0.1.0.vsix
./bin/openvscode-server --uninstall-extension /opt/openvscode-server/binary-dependencies/sqltools-0.24.0.vsix
./bin/openvscode-server --uninstall-extension undefined_publisher.vscode-rubicon

./bin/openvscode-server --install-extension /opt/openvscode-server/binary-dependencies/vscode-fentik-0.0.1.vsix
./bin/openvscode-server --install-extension /opt/openvscode-server/binary-dependencies/adpyke.vscode-sql-formatter-1.4.4.vsix
./bin/openvscode-server --port 3001 --host 0.0.0.0 --without-connection-token --default-folder $VSCODE_WORKSPACE --default-workspace $VSCODE_WORKSPACE
