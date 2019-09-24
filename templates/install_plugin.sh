#!/usr/bin/env bash

cd /app
composer require $1
php -d memory_limit=2G bin/magento setup:upgrade
php -d memory_limit=2G bin/magento deploy:mode:set production
