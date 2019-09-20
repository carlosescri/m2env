const child = require('child_process');
const fs = require('fs');
const util = require('util');

const mkdir = util.promisify(fs.mkdir);
const copyFile = util.promisify(fs.copyFile);
const writeFile = util.promisify(fs.writeFile);

function prefix(magento, php) {
  const M = magento.split('.').join('_');
  const P = php.split('.').join('_');
  return `magento${M}_php${P}`;
}

function composefile({magento, php, username, password}) {
  const PREFIX = prefix(magento, php);
  return `
version: '2'

# Docker configuration
networks:
  ${PREFIX}_network:
volumes:
  ${PREFIX}_db_mysql:

services:
  # Application container
  app:
    # container_name: ${PREFIX}_app
    image: m2env/nginx-php:${php}
    networks:
      - ${PREFIX}_network
    ports:
      - 80:80
    links:
      - db
    working_dir: /app
    environment:
      # Base env variables
      - COMPOSER_HOME=/.composer
      - COMPOSER_AUTH={"http-basic":{"repo.magento.com":{"username":"${username}","password":"${password}"}}}
      - NPM_CONFIG_CACHE=/.npm
      # Application env variables
      - WEB_ALIAS_DOMAIN=*.local
      - PHP_MEMORY_LIMIT=4G
      - PHP_DEBUGGER=none
      - XDEBUG_CONFIG=docker
      - MAGENTO_VERSION=${magento}
    volumes:
      # Base volumes
      - ~/.config/composer:/.composer
      - ./config/.bash_history:/home/application/.bash_history
      - ./config/install.sh:/home/application/install.sh
      # Application volumes
      - ./config/entrypoint.sh:/opt/docker/provision/entrypoint.d/90-custom.sh
      - ./config/nginx.conf:/opt/docker/etc/nginx/conf.d/02-dev.conf
      - ./project:/app
      - ./packages/:/packages

  # Database container
  db:
    # container_name: ${PREFIX}_db
    image: centos/mysql-57-centos7
    networks:
      - ${PREFIX}_network
    ports:
      - 3306:3306
    environment:
      - MYSQL_USER=user
      - MYSQL_PASSWORD=password
      - MYSQL_DATABASE=db
      - MYSQL_ROOT_PASSWORD=secret
      - MYSQL_MAX_ALLOWED_PACKET=512M
      - MYSQL_KEY_BUFFER_SIZE=1G
      - MYSQL_READ_BUFFER_SIZE=1G
      - MYSQL_INNODB_BUFFER_POOL_SIZE=1G
      - MYSQL_INNODB_LOG_FILE_SIZE=1G
      - MYSQL_INNODB_LOG_BUFFER_SIZE=1G
      - MYSQL_LOWER_CASE_TABLE_NAMES=1
    volumes:
      - ./resources/dump/:/dump
      - ./resources/db/:/var/lib/mysql

  # phpMyAdmin container
  phpmyadmin:
    # container_name: ${PREFIX}_phpmyadmin
    image: phpmyadmin/phpmyadmin
    links:
      - db
    ports:
      - 8080:80
    networks:
      - ${PREFIX}_network
    environment:
      - PMA_USER=root
      - PMA_PASSWORD=secret
`.trim();
}

async function createDirectory(dir) {
  try {
    await mkdir(dir);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

async function build(config) {
  const BASE_DIR = process.cwd();
  const CONFIG_DIR = `${BASE_DIR}/config`;
  const RESOURCES_DIR = `${BASE_DIR}/resources`;
  const PROJECT_DIR = `${BASE_DIR}/project`;
  const PACKAGES_DIR = `${BASE_DIR}/packages`;

  const TEMPLATES_DIR = `${__dirname}/../templates`;

  await writeFile(`${BASE_DIR}/docker-compose.yml`, composefile(config));

  await createDirectory(CONFIG_DIR);
  await createDirectory(RESOURCES_DIR);
  await createDirectory(PROJECT_DIR);
  await createDirectory(PACKAGES_DIR);

  await copyFile(`${TEMPLATES_DIR}/bash_history`, `${CONFIG_DIR}/.bash_history`);
  await copyFile(`${TEMPLATES_DIR}/install.sh`, `${CONFIG_DIR}/install.sh`);
  await copyFile(`${TEMPLATES_DIR}/entrypoint.sh`, `${CONFIG_DIR}/entrypoint.sh`);
  await copyFile(`${TEMPLATES_DIR}/nginx.conf`, `${CONFIG_DIR}/nginx.conf`);
}

function install(config) {
  return new Promise(async (resolve, reject) => {
    const builder = child.exec('docker-compose exec app gosu application /home/application/install.sh');
    builder.stdout.pipe(process.stdout);
    builder.stderr.pipe(process.stderr);

    builder.on('exit', async (code, _signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Magento 2 installation failed with code '${code}'!`));
      }
    });
  });
}

module.exports = {build, install};
