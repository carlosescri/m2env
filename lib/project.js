const child = require('child_process');
const fs = require('fs');
const util = require('util');

const chmod = util.promisify(fs.chmod);
const copyFile = util.promisify(fs.copyFile);
const mkdir = util.promisify(fs.mkdir);
const writeFile = util.promisify(fs.writeFile);

function prefix(magento, php) {
  const M = `${magento}`.split('.').join('_');
  const P = `${php}`.split('.').join('_');
  return `magento${M}_php${P}`;
}

function composefile({ magento, php, username, password, packages, composer }) {
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
      - ${composer || './composer'}:/.composer
      - ./config/.bash_history:/home/application/.bash_history
      - ./config/install.sh:/home/application/install.sh
      - ./config/install_plugin.sh:/home/application/install_plugin.sh
      # Application volumes
      - ./config/entrypoint.sh:/opt/docker/provision/entrypoint.d/90-custom.sh
      - ./config/nginx.conf:/opt/docker/etc/nginx/conf.d/02-dev.conf
      - ./project:/app
      - ${packages || './packages'}/:/app/packages

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
      - ./resources/dump:/dump
      - ./resources/db:/var/lib/mysql

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

function nginxfile({servername}) {
  return `
upstream fastcgi_backend {
  server  127.0.0.1:9000;
}

server {
  listen 80;
  server_name ${servername};
  set $MAGE_ROOT /app;

  root $MAGE_ROOT/pub;

  index index.php;
  autoindex off;
  charset UTF-8;
  error_page 404 403 = /errors/404.php;
  #add_header "X-UA-Compatible" "IE=Edge";

  # PHP entry point for setup application
  location ~* ^/setup($|/) {
      root $MAGE_ROOT;
      location ~ ^/setup/index.php {
          fastcgi_pass   fastcgi_backend;

          fastcgi_param  PHP_FLAG  "session.auto_start=off\nsuhosin.session.cryptua=off\nzlib.output_compression=On";
          fastcgi_param  PHP_VALUE "memory_limit=2G\nmax_execution_time=1800";
          fastcgi_read_timeout 1800s;
          fastcgi_connect_timeout 60s;

          fastcgi_index  index.php;
          fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
          include        fastcgi_params;
      }

      location ~ ^/setup/(?!pub/). {
          deny all;
      }

      location ~ ^/setup/pub/ {
          add_header X-Frame-Options "SAMEORIGIN";
      }
  }

  # PHP entry point for update application
  location ~* ^/update($|/) {
      root $MAGE_ROOT;

      location ~ ^/update/index.php {
          fastcgi_split_path_info ^(/update/index.php)(/.+)$;
          fastcgi_pass   fastcgi_backend;
          fastcgi_index  index.php;
          fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
          fastcgi_param  PATH_INFO        $fastcgi_path_info;
          include        fastcgi_params;
      }

      # Deny everything but index.php
      location ~ ^/update/(?!pub/). {
          deny all;
      }

      location ~ ^/update/pub/ {
          add_header X-Frame-Options "SAMEORIGIN";
      }
  }

  location / {
      try_files $uri $uri/ /index.php$is_args$args;
  }

  location /pub/ {
      location ~ ^/pub/media/(downloadable|customer|import|theme_customization/.*\.xml) {
          deny all;
      }
      alias $MAGE_ROOT/pub/;
      add_header X-Frame-Options "SAMEORIGIN";
  }

  location /static/ {
      # Uncomment the following line in production mode
      # expires max;

      # Remove signature of the static files that is used to overcome the browser cache
      location ~ ^/static/version {
          rewrite ^/static/(version[^/]+/)?(.*)$ /static/$2 last;
      }

      location ~* \.(ico|jpg|jpeg|png|gif|svg|js|css|swf|eot|ttf|otf|woff|woff2|json)$ {
          add_header Cache-Control "public";
          add_header X-Frame-Options "SAMEORIGIN";
          expires +1y;

          if (!-f $request_filename) {
              rewrite ^/static/?(.*)$ /static.php?resource=$1 last;
          }
      }
      location ~* \.(zip|gz|gzip|bz2|csv|xml)$ {
          add_header Cache-Control "no-store";
          add_header X-Frame-Options "SAMEORIGIN";
          expires    off;

          if (!-f $request_filename) {
              rewrite ^/static/?(.*)$ /static.php?resource=$1 last;
          }
      }
      if (!-f $request_filename) {
          rewrite ^/static/?(.*)$ /static.php?resource=$1 last;
      }
      add_header X-Frame-Options "SAMEORIGIN";
  }

  location /media/ {
      try_files $uri $uri/ /get.php$is_args$args;

      location ~ ^/media/theme_customization/.*\.xml {
          deny all;
      }

      location ~* \.(ico|jpg|jpeg|png|gif|svg|js|css|swf|eot|ttf|otf|woff|woff2)$ {
          add_header Cache-Control "public";
          add_header X-Frame-Options "SAMEORIGIN";
          expires +1y;
          try_files $uri $uri/ /get.php$is_args$args;
      }
      location ~* \.(zip|gz|gzip|bz2|csv|xml)$ {
          add_header Cache-Control "no-store";
          add_header X-Frame-Options "SAMEORIGIN";
          expires    off;
          try_files $uri $uri/ /get.php$is_args$args;
      }
      add_header X-Frame-Options "SAMEORIGIN";
  }

  location /media/customer/ {
      deny all;
  }

  location /media/downloadable/ {
      deny all;
  }

  location /media/import/ {
      deny all;
  }

  # PHP entry point for main application
  location ~ ^/(index|get|static|errors/report|errors/404|errors/503|health_check)\.php$ {
      try_files $uri =404;
      fastcgi_pass   fastcgi_backend;
      fastcgi_buffers 1024 16k;
      fastcgi_buffer_size 32k;

      fastcgi_param  PHP_FLAG  "session.auto_start=off\nsuhosin.session.cryptua=off\nzlib.output_compression=On";
      fastcgi_param  PHP_VALUE "memory_limit=2G\nmax_execution_time=1800";
      fastcgi_read_timeout 1800s;
      fastcgi_connect_timeout 60s;

      fastcgi_index  index.php;
      fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
      include        fastcgi_params;
  }

  gzip on;
  gzip_disable "msie6";

  gzip_comp_level 6;
  gzip_min_length 1100;
  gzip_buffers 16 8k;
  gzip_proxied any;
  gzip_types
      text/plain
      text/css
      text/js
      text/xml
      text/javascript
      application/javascript
      application/x-javascript
      application/json
      application/xml
      application/xml+rss
      image/svg+xml;
  gzip_vary on;

  # Banned locations (only reached if the earlier PHP entry point regexes don't match)
  location ~* (\.php$|\.htaccess$|\.git) {
      deny all;
  }
}
`.trim();
}

function installfile({magento, servername, language, currency, timezone}) {
  return `
#!/usr/bin/env bash

# create magento project inside /app/magento preventing non-empty dir error due to /app/packages
mkdir -p /app/magento
cd /app/magento
composer create-project --repository=https://repo.magento.com/ magento/project-community-edition:${magento} .

# move project to /app
cd /app
shopt -s dotglob
mv magento/* .
shopt -u dotglob
rmdir magento

# customize composer.json
jq '.repositories = [{"type": "path", "url": "/app/packages/*/*", "options": {"symlink": true}}, {"type": "composer", "url": "https://repo.magento.com/"}]' composer.json | sponge composer.json
jq '."minimum-stability" = "beta"' composer.json | sponge composer.json

# perform magento installation
php bin/magento setup:install --base-url=http://${servername}/ \
--db-host=db --db-name=db --db-user=root --db-password=secret \
--admin-firstname=Magento --admin-lastname=User --admin-email=user@example.com \
--admin-user=admin --admin-password=admin123 --language=${language} \
--currency=${currency} --timezone=${timezone} --use-rewrites=1 --backend-frontname=admin

# security recommendation
chmod a-w /app/app/etc

# perform magento post-installation steps
php -d memory_limit=2G bin/magento sample:deploy
php -d memory_limit=2G bin/magento setup:upgrade
php -d memory_limit=2G bin/magento cron:install
php -d memory_limit=2G bin/magento deploy:mode:set production
`.trim();
}

function supervisorfile() {
  return `
[program:magento]
command=docker-compose up --exit-code-from app
directory=${process.cwd()}
stdout_logfile=/var/log/magento.log
stderr_logfile=/var/log/magento.log
autostart=true
autorestart=true
startsecs=10
stopwaitsecs=30
`.trim();
}

async function createDirectory(dir, permissions=0o775) {
  try {
    await mkdir(dir);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  } finally {
    await chmod(dir, permissions);
  }
}

async function build(config) {
  const BASE_DIR = process.cwd();
  const CONFIG_DIR = `${BASE_DIR}/config`;
  const TEMPLATES_DIR = `${__dirname}/../templates`;

  await writeFile(`${BASE_DIR}/docker-compose.yml`, composefile(config));

  await createDirectory(CONFIG_DIR);

  await createDirectory(`${BASE_DIR}/project`);
  await createDirectory(`${BASE_DIR}/resources`);

  // https://hub.docker.com/r/centos/mysql-57-centos7/
  // Notice: When mouting a directory from the host into the container,
  // ensure that the mounted directory has the appropriate permissions
  // and that the owner and group of the directory matches the user UID
  // or name which is running inside the container.
  await createDirectory(`${BASE_DIR}/resources/db`, 0o777);
  await createDirectory(`${BASE_DIR}/resources/dump`, 0o777);

  if (!config.packages) {
    await createDirectory(`${BASE_DIR}/packages`);
  }

  if (!config.composer) {
    await createDirectory(`${BASE_DIR}/composer`);
  }

  await writeFile(`${CONFIG_DIR}/nginx.conf`, nginxfile(config));
  await writeFile(`${CONFIG_DIR}/install.sh`, installfile(config));
  await writeFile(`${CONFIG_DIR}/magento-supervisor.conf`, supervisorfile());

  ['.bash_history', 'install_plugin.sh', 'entrypoint.sh'].forEach(async target => {
    const source = target.replace(/^\./, '');
    await copyFile(`${TEMPLATES_DIR}/${source}`, `${CONFIG_DIR}/${target}`);
  });
}

function run(command, _config) {
  return new Promise(async (resolve, reject) => {
    const builder = child.exec(command);
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

function runScript(command, config) {
  return run(`docker-compose exec -T app gosu application /home/application/${command}`, config);
}

function runCommand(command, config) {
  return run(`docker-compose exec -T app gosu application ${command}`, config);
}

async function refresh(config) {
  await runCommand(`php -d memory_limit=2G bin/magento setup:upgrade`, config);
  return await runCommand(`php -d memory_limit=2G bin/magento deploy:mode:set production`, config);
}

module.exports = { runScript, runCommand, build, refresh };
