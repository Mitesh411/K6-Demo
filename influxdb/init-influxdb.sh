#!/bin/bash
set -e

influx -execute "CREATE DATABASE k6"
influx -execute "CREATE DATABASE sitespeed"
echo "InfluxDB databases 'k6' and 'sitespeed' created successfully."
