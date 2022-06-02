# syntax=docker/dockerfile:1

FROM node:16.15.0-buster
ARG BUILDARCH
RUN apt-get update && \
    apt-get install -y libsecret-1-dev libx11-dev libxkbfile-dev \
    bash \
    python3 \
    cron \
    python3-pip && \
    pip3 install requests networkx jinja2
WORKDIR "/opt/dataflo/python/ops/docker"
COPY "docker/scripts/." "./"
COPY "docker/scripts/refresh_git_config_cron" "/etc/cron.d/refresh_git_config_cron"
RUN chmod 0644 /etc/cron.d/refresh_git_config_cron
RUN crontab /etc/cron.d/refresh_git_config_cron
WORKDIR "/opt/openvscode-server"
COPY "./" "./"
RUN ./docker/build_vscode.sh ${BUILDARCH}
CMD [ "bash", "-c", "./docker/scripts/ide_server_init.sh" ]
EXPOSE 3001/tcp
