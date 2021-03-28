// ==UserScript==
// @name         video2wledwall
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  takes html5 video object and sends it to wled using websocket api
// @author       You
// @match         https://www.youtube.com/watch*
// @connect      4.3.2.1
// @grant        GM.xmlHttpRequest
// @run-at      document-idle
// @downloadURL https://github.com/scamiv/html5video2wled/blob/main/main.js
// ==/UserScript==

var ledPerPacket = 60;
ledPerPacket = ledPerPacket * 2;

var map = [15, 16, 47, 48, 79, 80, 111, 112, 143, 144, 175, 176, 207, 208, 239, 240, 271, 272,
  14, 17, 46, 49, 78, 81, 110, 113, 142, 145, 174, 177, 206, 209, 238, 241, 270, 273,
  13, 18, 45, 50, 77, 82, 109, 114, 141, 146, 173, 178, 205, 210, 237, 242, 269, 274,
  12, 19, 44, 51, 76, 83, 108, 115, 140, 147, 172, 179, 204, 211, 236, 243, 268, 275,
  11, 20, 43, 52, 75, 84, 107, 116, 139, 148, 171, 180, 203, 212, 235, 244, 267, 276,
  10, 21, 42, 53, 74, 85, 106, 117, 138, 149, 170, 181, 202, 213, 234, 245, 266, 277,
  9, 22, 41, 54, 73, 86, 105, 118, 137, 150, 169, 182, 201, 214, 233, 246, 265, 278,
  8, 23, 40, 55, 72, 87, 104, 119, 136, 151, 168, 183, 200, 215, 232, 247, 264, 279,
  7, 24, 39, 56, 71, 88, 103, 120, 135, 152, 167, 184, 199, 216, 231, 248, 263, 280,
  6, 25, 38, 57, 70, 89, 102, 121, 134, 153, 166, 185, 198, 217, 230, 249, 262, 281,
  5, 26, 37, 58, 69, 90, 101, 122, 133, 154, 165, 186, 197, 218, 229, 250, 261, 282,
  4, 27, 36, 59, 68, 91, 100, 123, 132, 155, 164, 187, 196, 219, 228, 251, 260, 283,
  3, 28, 35, 60, 67, 92, 99, 124, 131, 156, 163, 188, 195, 220, 227, 252, 259, 284,
  2, 29, 34, 61, 66, 93, 98, 125, 130, 157, 162, 189, 194, 221, 226, 253, 258, 285,
  1, 30, 33, 62, 65, 94, 97, 126, 129, 158, 161, 190, 193, 222, 225, 254, 257, 286,
  0, 31, 32, 63, 64, 95, 96, 127, 128, 159, 160, 191, 192, 223, 224, 255, 256, 287
]
var processor = {

  timerCallback: function() {
    if (this.video.paused || this.video.ended) {
      return;
    }
    this.computeFrame();
    let self = this;
    setTimeout(function() {
      self.timerCallback();
    }, 50);
  },

  doLoad: function() {
    this.video = document.querySelector(".html5-video-container > video");
    this.c1 = document.createElement('canvas');
    this.c1.width = 18;
    this.c1.height = 16;
    this.c1.style.position = "fixed";
    this.c1.style.zIndex = "9999";
    this.c1.style.width = this.c1.width * 10 + "px";

    document.body.appendChild(this.c1);
    this.ctx1 = this.c1.getContext("2d");
    this.ctx1.rect(0, 0, this.c1.width, this.c1.height);
    this.ctx1.fillStyle = "grey";



    let self = this;

    this.webSocket = this.wsconnect();
    this.video.addEventListener("play", function() {
      self.aspect = self.video.videoWidth /  self.video.videoHeight;
      self.timerCallback();

    }, false);



  },
  wsconnect: function() {
    this.webSocket = new WebSocket('ws://4.3.2.1/ws');
    this.webSocket.onmessage = function(e) {
      console.log('Message:', e.data);
    };
    this.webSocket.onclose = function(e) {
      console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);
      setTimeout(function() {
        processor.wsconnect();
      }, 500);
    };
    let self = this;
    this.webSocket.onerror = function(err) {
      console.error('Socket encountered error: ', err.message, 'Closing socket');
      self.webSocket.close();
    };
    return this.webSocket;
  },
  computeFrame: function() {
    var left = 0;
    var extrawidth = (this.c1.height * this.aspect) - this.c1.width;
    if (extrawidth > 0) { 
    	left = (extrawidth / 2) * -1;
    }
console.log(left);
    
    this.ctx1.drawImage(this.video, left, 0,extrawidth +  this.c1.width, this.c1.height );

    var frame = this.ctx1.getImageData(0, 0, this.c1.width, this.c1.height);
    let l = frame.data.length;
    var leds = new Array();
    var rgb = new Array();

    //topleft to bottom right
    for (let i = 0; i < l;) {
      rgb[0] = frame.data[i++];
      rgb[1] = frame.data[i++];
      rgb[2] = frame.data[i++];
      i++;
      leds.push(map[i / 4]); //{"seg":{"i":[0,[255,0,0], 1,[0,255,0], 2,[0,0,255]]}}
      leds.push(rgb);
      rgb = new Array();
    }
    try {
      //wled cant handle fragmentation, keep packets small enugh
      for (let i = 0; i < leds.length / ledPerPacket;) {
        var reqpayload = JSON.stringify({
          "seg": {
            "i": leds.slice(ledPerPacket * i, ledPerPacket * (i + 1))
          }
        });

        //console.log(reqpayload);
        this.webSocket.send(reqpayload);
        i++;
      };

    } catch (error) {
      console.error(error);
    }
  }
};

processor.doLoad();
