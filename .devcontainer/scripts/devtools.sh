# Prioritize scripts in the mounted project folder for live updates
if [ -d "/project/.devcontainer/scripts/devtool-scripts" ]; then
  BASE_DIR="/project/.devcontainer/scripts"
else
  BASE_DIR="/usr/local/bin"
fi

source $BASE_DIR/devtool-scripts/constants.sh
source $BASE_DIR/devtool-scripts/$1.sh
