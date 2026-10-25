#!/usr/bin/env python3
"""
Archive of Matter - Local Development & Persistence Server
- Serves static assets on the specified port (default 8088).
- Provides /api/save-archive endpoint to permanently save browser UI edits
  directly to data/archive.json and maintain timestamped backups.
"""

import os
import sys
import json
import time
import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
ARCHIVE_JSON_PATH = os.path.join(DATA_DIR, 'archive.json')
BACKUP_DIR = os.path.join(DATA_DIR, 'backups')

class ArchiveServerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        clean_path = self.path.split('?')[0].lower()
        if clean_path.endswith(('.json', '.js', '.html', '.css')) or clean_path == '/':
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/save-archive':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length <= 0:
                self.send_error(400, "Empty payload")
                return

            body = self.rfile.read(content_length)
            try:
                payload = json.loads(body.decode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': f'Invalid JSON: {str(e)}'}).encode('utf-8'))
                return

            try:
                # Ensure directories exist
                os.makedirs(DATA_DIR, exist_ok=True)
                os.makedirs(BACKUP_DIR, exist_ok=True)

                # Read existing archive.json as safeguard
                existing_data = {}
                if os.path.exists(ARCHIVE_JSON_PATH):
                    try:
                        with open(ARCHIVE_JSON_PATH, 'r', encoding='utf-8') as ef:
                            existing_data = json.load(ef)
                    except Exception:
                        existing_data = {}

                incoming_objects = payload.get("objects", [])
                incoming_memos = payload.get("memos", [])
                incoming_fr = payload.get("fieldResearch", [])

                # Safety guard: never wipe with empty arrays unless explicitly intended
                final_objects = incoming_objects if (isinstance(incoming_objects, list) and len(incoming_objects) > 0) else existing_data.get("objects", [])
                final_memos = incoming_memos if (isinstance(incoming_memos, list) and len(incoming_memos) > 0) else existing_data.get("memos", [])
                final_fr = incoming_fr if (isinstance(incoming_fr, list) and len(incoming_fr) > 0) else existing_data.get("fieldResearch", [])

                archive_data = {
                    "objects": final_objects,
                    "memos": final_memos,
                    "fieldResearch": final_fr,
                    "memoPositions": payload.get("memoPositions") or existing_data.get("memoPositions", {}),
                    "memoConnections": payload.get("memoConnections") or existing_data.get("memoConnections", []),
                    "lastSaved": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }

                # 1. Create timestamped backup
                ts_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_path = os.path.join(BACKUP_DIR, f"archive_{ts_str}.json")
                with open(backup_path, 'w', encoding='utf-8') as bf:
                    json.dump(archive_data, bf, ensure_ascii=False, indent=2)

                # 2. Write to primary data/archive.json atomically
                temp_path = ARCHIVE_JSON_PATH + ".tmp"
                with open(temp_path, 'w', encoding='utf-8') as tf:
                    json.dump(archive_data, tf, ensure_ascii=False, indent=2)
                os.replace(temp_path, ARCHIVE_JSON_PATH)

                print(f"[Server] Successfully saved archive data: {len(archive_data['objects'])} objects, {len(archive_data['memos'])} memos to {ARCHIVE_JSON_PATH}")

                resp = {
                    'success': True,
                    'message': '소스 파일(data/archive.json)에 성공적으로 저장되었습니다.',
                    'timestamp': archive_data['lastSaved'],
                    'counts': {
                        'objects': len(archive_data['objects']),
                        'memos': len(archive_data['memos']),
                        'fieldResearch': len(archive_data['fieldResearch'])
                    },
                    'backup': os.path.basename(backup_path)
                }

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(resp, ensure_ascii=False).encode('utf-8'))

            except Exception as e:
                print(f"[Server] Save error: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode('utf-8'))
        else:
            self.send_error(404, "Endpoint not found")

def run(port=8088):
    server_address = ('', port)
    httpd = HTTPServer(server_address, ArchiveServerHandler)
    print(f"=== Archive of Matter Server running on port {port} ===")
    print(f"Serving directory: {BASE_DIR}")
    print(f"Save API: POST http://localhost:{port}/api/save-archive")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down.")
        httpd.server_close()

if __name__ == '__main__':
    port = 8088
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run(port)
