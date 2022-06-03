#!/bin/bash

set -e

yarn

case $1 in
    x64)
       yarn gulp vscode-reh-web-linux-x64-min
       ;;

    arm64)
       yarn gulp vscode-reh-web-linux-arm64-min
       ;;

    *)
       echo Unsupported platform $1
       exit 1
       ;;
esac
