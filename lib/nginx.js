const child = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');

const mkdtemp = util.promisify(fs.mkdtemp);
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);
const rmdir = util.promisify(fs.rmdir);

function dockerfile(php) {
  return `
FROM webdevops/php-nginx-dev:${php}

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

function composefile(php) {
  return `
version: '2'

services:
  app:
    build:
      context: .
      dockerfile: ./Dockerfile
    image: m2env/nginx-php:${php}
`.trim();
}

async function buildImage(php) {
  return new Promise(async (resolve, reject) => {
    const CWD = process.cwd();
    const BUILD_DIR = await mkdtemp(path.join(os.tmpdir(), 'm2env-'));
    const DOCKERFILE_FILE = `${BUILD_DIR}/Dockerfile`;
    const COMPOSE_FILE = `${BUILD_DIR}/docker-compose.yml`;

    await writeFile(DOCKERFILE_FILE, dockerfile(php));
    await writeFile(COMPOSE_FILE, composefile(php));

    process.chdir(BUILD_DIR);

    const builder = child.exec('docker-compose build app');
    builder.stdout.pipe(process.stdout);
    builder.stderr.pipe(process.stderr);

    builder.on('exit', async (code, _signal) => {
      await unlink(COMPOSE_FILE);
      await unlink(DOCKERFILE_FILE);

      process.chdir(CWD);
      await rmdir(BUILD_DIR);

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`NGINX image builder returned with code '${code}'!`));
      }
    });
  });
}

module.exports = {buildImage};
