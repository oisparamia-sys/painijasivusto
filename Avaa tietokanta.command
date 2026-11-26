#!/bin/zsh
cd -- "${0:A:h}" || exit 1
exec python3 tools/dev-server.py --port 0 --open-page tietokanta.html
