#!/usr/bin/env bash

set -euo pipefail

rm -f "$HOME/Library/Application Support/kata-orchestrator-desktop-ui/app-state.json"
rm -f "$HOME/.kata/state.json"
rm -rf "$HOME/.kata/workspaces"
rm -rf "$HOME/.kata/repos"

echo "Kata desktop local state reset complete."
