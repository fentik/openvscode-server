#!/bin/bash

set -e

yarn

echo "Building VS Code for architecture $1"
yarn gulp vscode-reh-web-$1-min
