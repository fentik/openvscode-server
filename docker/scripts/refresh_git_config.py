import logging
import os
import re
import subprocess
import sys

import requests

"""
This script runs as a cron job in the IDE docker container, so make sure we don't add any dependencies
other than core python
"""

logging.basicConfig(format='[%(asctime)s %(levelname)-2s] %(message)s', stream=sys.stdout, level=logging.INFO, datefmt='%Y-%m-%d %H:%M:%S')


def update_git_config(access_token):
    logging.info("Getting the current url for the repo in current directory...")
    output = subprocess.run(
        ["git", "remote", "get-url", "origin"], capture_output=True, text=True
    )
    if output.returncode == 0:
        url = output.stdout.strip()
    else:
        logging.error("Failed to update the access_token.")
    logging.info(f"The URL for the repo is {url}")
    new_url = re.sub(
        'x-access-token:[a-zA-z0-9]*@', f'x-access-token:{access_token}@', url
    )
    logging.info(f"Replacing the URL with {new_url}.")
    output = subprocess.run(
        ["git", "remote", "set-url", "origin", new_url], capture_output=True, text=True
    )
    if output.returncode == 0:
        return True
    logging.error("Failed to update the access_token.")
    return False


def main():
    headers = {
        'Authorization': 'Token ' + os.environ['INTERNAL_SERVER_API_TOKEN'],
        'X-Auth-User-Id': os.environ['DFCTL_USER_ID'],
    }
    server_url = os.environ['DFCTL_API_ENDPOINT'] + "/github_app_access_token"
    logging.info(
        f"Requesting token from {server_url} for user {os.environ['DFCTL_USER_ID']}"
    )
    res = requests.get(server_url, headers=headers)
    if res.status_code != 200:
        logging.error(
            f"Failed to fetch a new access token from {os.environ['DFCTL_API_ENDPOINT']}"
        )
        res.raise_for_status()
    output = res.json()
    update_git_config(output['access_token'])


if __name__ == '__main__':
    main()
