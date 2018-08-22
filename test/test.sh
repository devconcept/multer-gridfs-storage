#!/bin/bash
set -ev
node_version=$(node -v);
echo "Running in node " ${node_version};
if  [ ${node_version:1:2} = "0." ]; then
  mocha --require babel-register --require babel-polyfill
  else
  mocha --exit --require babel-register --require babel-polyfill
fi

