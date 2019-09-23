const child = require('child_process');
const fs = require('fs');
const util = require('util');

const mkdir = util.promisify(fs.mkdir);
const copyFile = util.promisify(fs.copyFile);
const writeFile = util.promisify(fs.writeFile);

function prefix(magento, php) {
  const M = `${magento}`.split('.').join('_');
  const P = `${php}`.split('.').join('_');
  return `magento${M}_php${P}`;
}

function composefile({ magento, php, username, password, packages }) {
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
      - WEB_ALIAS_DOMAIN=*.localhost
      - PHP_MEMORY_LIMIT=4G
      - PHP_DEBUGGER=none
      - XDEBUG_CONFIG=docker
      - MAGENTO_VERSION=${magento}
    volumes:
      # Base volumes
      - ~/.config/composer:/.composer
      - ./config/.bash_history:/home/application/.bash_history
      - ./config/install.sh:/home/application/install.sh
      - ./config/install_plugin.sh:/home/application/install_plugin.sh
      # Application volumes
      - ./config/entrypoint.sh:/opt/docker/provision/entrypoint.d/90-custom.sh
      - ./config/nginx.conf:/opt/docker/etc/nginx/conf.d/02-dev.conf
      - ./project:/app
      - ${packages || './packages'}/:/packages

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
  const TEMPLATES_DIR = `${__dirname}/../templates`;

  await writeFile(`${BASE_DIR}/docker-compose.yml`, composefile(config));

  await createDirectory(CONFIG_DIR);

  await createDirectory(`${BASE_DIR}/resources`);
  await createDirectory(`${BASE_DIR}/project`);

  if (!config.packages) {
    await createDirectory(`${BASE_DIR}/packages`);
  }

  ['.bash_history', 'install.sh', 'install_plugin.sh', 'entrypoint.sh', 'nginx.conf'].forEach(async target => {
    const source = target.replace(/^\./, '');
    await copyFile(`${TEMPLATES_DIR}/${source}`, `${CONFIG_DIR}/${target}`);
  });
}

function run(command, config) {
  return new Promise(async (resolve, reject) => {
    const builder = child.exec(`docker-compose exec -T app gosu application /home/application/${command}`/*, {stdio: 'inherit'}*/);
    builder.stdout.pipe(process.stdout);
    builder.stderr.pipe(process.stderr);

    builder.on('exit', async (code, _signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(code);
      }
    });
  });
}

module.exports = { build, run };
