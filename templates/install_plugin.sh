#!/usr/bin/env bash

cd /app
composer require $1
php bin/magento setup:upgrade
php bin/magento setup:di:compile
