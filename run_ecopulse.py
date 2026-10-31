"""Start EcoPulse locally and open the browser; run using the project's virtualenv."""
from pathlib import Path
import json
import os
import subprocess
import sys
import time
import urllib.request
import webbrowser

ROOT=Path(__file__).resolve().parent
URL='http://127.0.0.1:8000'

def ready():
    try:
        with urllib.request.urlopen(URL+'/api/v1/health',timeout=2) as response:
            data=json.load(response)
            return data.get('status')=='ready' and data.get('equipment_control') is False
    except Exception:
        return False

if not (ROOT/'frontend/dist/index.html').exists():
    sys.exit('Build the frontend first: cd frontend, npm install, npm run build')
if not ready():
    (ROOT/'work').mkdir(exist_ok=True)
    with (ROOT/'work/server.log').open('a',encoding='utf-8') as log:
        server=subprocess.Popen([sys.executable,'-m','uvicorn','backend.main:app','--host','127.0.0.1','--port','8000'],cwd=ROOT,stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
    (ROOT/'work/server.pid').write_text(str(server.pid))
    for _ in range(90):
        if ready():break
        if server.poll() is not None:sys.exit('Server stopped. Check work/server.log (port 8000 may be occupied).')
        time.sleep(1)
    else:sys.exit('Startup timed out. Check work/server.log.')
print('EcoPulse is running at '+URL)
webbrowser.open(URL)
