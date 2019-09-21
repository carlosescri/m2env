#!/usr/bin/env bash

cd /app

composer create-project --repository=https://repo.magento.com/ magento/project-community-edition:$MAGENTO_VERSION .

jq '.repositories = [{"type": "path", "url": "/packages/*/*", "options": {"symlink": true}}, {"type": "composer", "url": "https://repo.magento.com/"}]' composer.json | sponge composer.json

php bin/magento setup:install --base-url=http://magento.local/ \
--db-host=db --db-name=db --db-user=root --db-password=secret \
--admin-firstname=Magento --admin-lastname=User --admin-email=user@example.com \
--admin-user=admin --admin-password=admin123 --language=en_US \
--currency=USD --timezone=America/Chicago --use-rewrites=1 --backend-frontname=admin

php bin/magento sample:deploy
php bin/magento setup:upgrade
php bin/magento deploy:mode:set production
