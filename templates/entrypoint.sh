#!/usr/bin/env bash

IP=`/sbin/ip route|awk '/default/ { print $3 }'`

echo "" >> /opt/docker/etc/php/php.ini
echo "xdebug.remote_host=$IP" >> /opt/docker/etc/php/php.ini

chmod a+x /home/application/*.sh
