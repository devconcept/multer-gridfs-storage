#!/bin/bash
set -ev
node_version=$(node -v);
if  [ ${node_version:0:2} = "0." ]; then
  echo "Installing legacy dependencies";
  npm install mongodb@2;
  npm install mocha@3;
  npm install chai@3;
  if  [ ${node_version:2:2} = 10 ]; then
    echo "Installing promise support";
    npm install es6-promise;
  fi
fi
