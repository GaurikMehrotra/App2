from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os

os.chdir(Path(__file__).resolve().parents[1] / 'apps/public/dist')

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        target = super().translate_path(path)
        if not Path(target).exists() and Path(target + '.html').is_file():
            return target + '.html'
        if not Path(target).exists():
            route = path.split('?')[0]
            if route.startswith('/post/'):
                return str(Path.cwd() / 'post/[id].html')
            if route.startswith('/person/'):
                return str(Path.cwd() / 'person/[handle].html')
        return target

ThreadingHTTPServer(('127.0.0.1', 8088), Handler).serve_forever()
