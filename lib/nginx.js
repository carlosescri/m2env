const child = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function dockerfile(phpversion) {
  return `
FROM webdevops/php-nginx-dev:${phpversion}

RUN mkdir -p /opt/docker/provision/entrypoint
WORKDIR /opt/docker/provision/entrypoint

RUN echo "#!/usr/bin/env bash\\n" \\
         "# This file will be replaced later\\n" > 90-custom.sh

RUN curl -sL https://deb.nodesource.com/setup_6.x | bash -

RUN apt-get install -y \\
    nodejs \\
    mysql-client \\
    iproute \\
    less \\
    nano \\
    iputils-ping \\
    libsasl2-modules

RUN npm install -g n
RUN n lts
RUN npm update -g npm

RUN docker-image-cleanup
`.trim();
}

function composefile(phpversion) {
  return `
version: '2'

services:
  app:
    build:
      context: .
      dockerfile: ./Dockerfile
    image: m2env/nginx-php:${phpversion}
`.trim();
}

function buildImage(phpversion) {
  const CWD = process.cwd();
  const BUILD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'm2env-'));
  const DOCKERFILE_FILE = `${BUILD_DIR}/Dockerfile`;
  const COMPOSE_FILE = `${BUILD_DIR}/docker-compose.yml`;

  fs.writeFileSync(DOCKERFILE_FILE, dockerfile(phpversion));
  fs.writeFileSync(COMPOSE_FILE, composefile(phpversion));

  process.chdir(BUILD_DIR);
  const builder = child.exec('docker-compose build app');
  builder.stdout.pipe(process.stdout);
  builder.stderr.pipe(process.stderr);

  builder.on('exit', (code, _signal) => {
    fs.unlinkSync(COMPOSE_FILE);
    fs.unlinkSync(DOCKERFILE_FILE);

    process.chdir(CWD);
    fs.rmdirSync(BUILD_DIR);
  });
}

module.exports = {buildImage};
