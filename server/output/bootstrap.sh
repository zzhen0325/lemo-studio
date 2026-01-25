#!/usr/bin/env bash
chown root:root $PWD
export PATH="$PWD/node_modules/.bin:$PATH"

# The following code is a user "start" script appended during build time.
exec env NODE_ENV=production gulux start