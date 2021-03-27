// ==UserScript==
// @name         video2wledwall
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  takes html5 video object and sends it to wled using websocket api
// @author       You
// @match         https://www.youtube.com/watch*
// @connect      4.3.2.1
// @grant        GM.xmlHttpRequest
// @run-at      document-idle
// ==/UserScript==

var ledPerPacket = 60;
ledPerPacket=ledPerPacket*2;
var processor = {

    timerCallback: function() {
        if (this.video.paused || this.video.ended) {
            return;
        }
        this.computeFrame();
        let self = this;
        setTimeout(function() {
            self.timerCallback();
        }, 100);
    },

    doLoad: function() {
        this.video = document.querySelector(".html5-video-container > video");
        this.c1 = document.createElement('canvas');
        this.c1.width = 16;
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
            self.width = self.video.videoWidth / 2;
            self.height = self.video.videoHeight / 2;
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
            }, 1000);
        };
        let self = this;
        this.webSocket.onerror = function(err) {
            console.error('Socket encountered error: ', err.message, 'Closing socket');
            self.webSocket.close();
        };
        return this.webSocket;
    },
    computeFrame: function() {


        this.ctx1.drawImage(this.video, 0, 0, this.c1.width, this.c1.height);

        let frame = this.ctx1.getImageData(0, 0, this.c1.width, this.c1.height);
        let l = frame.data.length;
        var leds = new Array();
        var rgb = new Array();

        //topleft to bottom right
        for (let i = 0; i < l;) {
            rgb[0] = frame.data[i++];
            rgb[1] = frame.data[i++];
            rgb[2] = frame.data[i++];
            i++;
            leds.push(i/4 -1); //{"seg":{"i":[0,[255,0,0], 1,[0,255,0], 2,[0,0,255]]}}
            leds.push(rgb);
        }

        try {
						//wled cant handle fragmentation, keep packets small enugh
            for (let i = 0; i < leds.length  / ledPerPacket;) {
                var reqpayload = JSON.stringify({
                    "seg": {
                        "i": leds.slice(ledPerPacket * i, ledPerPacket * (i + 1))
                    }
                });

                console.log(reqpayload);
                this.webSocket.send(reqpayload);
              i++;
            };

        } catch (error) {
            console.error(error);
        }
    }
};

processor.doLoad();

