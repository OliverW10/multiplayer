# Use this insead of python -m http.server beacuse it gives the correct file type on javascript files
# which give errors for some reason otherwise

import http.server
import socketserver

PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({
      ".js": "application/javascript",
})

httpd = socketserver.TCPServer(("", PORT), Handler)
httpd.serve_forever()