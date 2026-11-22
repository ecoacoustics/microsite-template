#!/bin/sh
exec hugo server --themesDir=../.. --tlsAuto "$@"
