#!/usr/bin/env python3
"""Static server for the Piper demo with cross-origin isolation enabled.

onnxruntime-web can only run multi-threaded WASM (using SharedArrayBuffer) when
the page is "cross-origin isolated". That requires two response headers that the
stock `python -m http.server` does not send:

    Cross-Origin-Opener-Policy: same-origin
    Cross-Origin-Embedder-Policy: credentialless

We use `credentialless` rather than `require-corp`: both enable cross-origin
isolation (and thus SharedArrayBuffer / threads), but `credentialless` still lets
no-cors cross-origin assets load (e.g. the sponsor badge), instead of blocking
anything that doesn't send a CORP header. Supported in Firefox 119+ / Chrome 110+.

Run this from the demo directory:

    python serve.py            # serves on http://localhost:8080
    python serve.py 8080       # custom port

After loading the page, confirm in the browser console:

    crossOriginIsolated === true

If that is false, the headers are not reaching the browser and inference will
stay single-threaded.
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class CrossOriginIsolatedHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "credentialless")
        # Avoid stale assets while developing.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    handler = partial(CrossOriginIsolatedHandler, directory=".")
    with ThreadingHTTPServer(("0.0.0.0", port), handler) as httpd:
        print(f"Serving cross-origin-isolated demo on http://localhost:{port}")
        print("Confirm `crossOriginIsolated === true` in the browser console.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
