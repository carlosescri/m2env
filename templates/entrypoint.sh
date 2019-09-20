#!/usr/bin/env bash

echo "" >> /opt/docker/etc/php/php.ini
echo "xdebug.remote_host="`/sbin/ip route|awk '/default/ { print $3 }'` >> /opt/docker/etc/php/php.ini
