#!/usr/bin/env python3
"""Compatibility launcher; catalogue and parsing live only in tools/ligadb.py."""
import pathlib,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent/'tools'))
from ligadb import main
if __name__=='__main__':main()
