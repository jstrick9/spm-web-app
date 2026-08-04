#!/usr/bin/env python3.11
"""
Simple HTTP server that lets the deploy dashboard
run shell commands on your Mac.
"""
import subprocess
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

HOME = os.path.expanduser("~")
PATH = f"/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:{os.environ.get('PATH', '')}"

class Handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/run':
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
            command = body.get('command', '')

            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=120,
                cwd=f"{HOME}/ai-workspace/spm-web-app",
                env={**os.environ, 'PATH': PATH, 'HOME': HOME}
            )

            output = result.stdout
            if result.stderr:
                output += f"\n{result.stderr}"

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'output': output or '(no output)',
                'exit_code': result.returncode
            }).encode())

    def log_message(self, format, *args):
        pass  # Suppress request logs

if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', 9001), Handler)
    print("✅ Deploy server running on port 9001")
    server.serve_forever()
