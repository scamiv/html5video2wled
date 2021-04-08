# html5video2wled
Stream a html video element (youtube for now, missing gui) to esp32 running wled using the json websocket api. Tested with 16x32 led matrix.

### Needs insecure ws from https to work with https sites.
Firefox: about:config > network.websocket.allowInsecureFromHTTPS > true 

Chrome: add ws://wledip to chrome://flags/#unsafely-treat-insecure-origin-as-secure
