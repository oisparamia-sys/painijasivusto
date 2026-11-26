"""Local development preview. Loopback only; never deploys or writes production data."""
import argparse,http.server,pathlib,urllib.parse,webbrowser
class Handler(http.server.SimpleHTTPRequestHandler):
 def list_directory(self,path):self.send_error(403,'Directory listing disabled')
 def do_GET(self):
  parts=pathlib.PurePosixPath(urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)).parts
  if any(p.startswith('.') for p in parts) or '..' in parts:self.send_error(403);return
  super().do_GET()
 def end_headers(self):
  self.send_header('Cache-Control','no-store');self.send_header('X-Robots-Tag','noindex, nofollow');self.send_header('X-Content-Type-Options','nosniff');super().end_headers()
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8875);parser.add_argument('--no-open',action='store_true');args=parser.parse_args()
 root=pathlib.Path(__file__).resolve().parents[1]
 from functools import partial
 with http.server.ThreadingHTTPServer(('127.0.0.1',args.port),partial(Handler,directory=str(root))) as server:
  url=f'http://127.0.0.1:{args.port}/';print('Yksityinen paikallinen kehitysversio: '+url,flush=True)
  if not args.no_open:webbrowser.open(url)
  try:server.serve_forever()
  except KeyboardInterrupt:pass
if __name__=='__main__':main()
