#!/bin/sh
# scripts/init-solr.sh

# Exit immediately if a command exits with a non-zero status.
set -e

echo "Solr init: Configuring default search field (df=text_txt_en) for /select handler..."

# Define the JSON payload using a variable for clarity
JSON_PAYLOAD='{
  "update-requesthandler": {
    "name": "/select",
    "class": "solr.SearchHandler",
    "defaults": {
      "df": "text_txt_en"
    }
  }
}'

# Use curl to send the request to Solr
# The script runs inside the docker network, so 'solr' is the correct hostname
curl -X POST -H "Content-type:application/json" --fail --silent --show-error \
     --data-binary "$JSON_PAYLOAD" \
     http://solr:8983/solr/slack_messages/config

echo "Solr init: Configuration complete."

# Exit with success
exit 0
