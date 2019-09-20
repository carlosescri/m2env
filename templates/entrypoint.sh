#!/usr/bin/env bash

IP=`/sbin/ip route|awk '/default/ { print $3 }'`

if [[ -f "/app/composer.json" ]]; then
    echo "Already installed, nothing to do!"
    echo "Current IP: $IP"
else
    echo "" >> /opt/docker/etc/php/php.ini
    echo "xdebug.remote_host=$IP" >> /opt/docker/etc/php/php.ini
fi
