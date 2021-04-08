// ==UserScript==
// @name         video2wledwall
// @namespace    https://github.com/scamiv/html5video2wled
// @version      0.71
// @description  takes html5 video object and sends it to wled using websocket api
// @author       You
// @match         *://*.youtube.com/*
// @match        *://*.akamaihd.net/*
// @connect      4.3.2.1
// @grant        GM.xmlHttpRequest
// @run-at      document-idle
// @downloadURL https://github.com/scamiv/html5video2wled/raw/main/main.user.js
// @updateURL https://github.com/scamiv/html5video2wled/raw/main/main.user.js
// ==/UserScript==

const WallWidth = 32;
const WallHeigth = 16;
const resample = true; //resize/resample using Hermite filter

var ledPerPacket = 72; //could go for bytes per packet to squeeze some more fps out
const maxPps = 120; // packages per second, experimental value

const gamma = 2.2;

const map = [15,16,47,48,79,80,111,112,143,144,175,176,207,208,239,240,271,272,303,304,335,336,367,368,399,400,431,432,463,464,495,496,
             14,17,46,49,78,81,110,113,142,145,174,177,206,209,238,241,270,273,302,305,334,337,366,369,398,401,430,433,462,465,494,497,
             13,18,45,50,77,82,109,114,141,146,173,178,205,210,237,242,269,274,301,306,333,338,365,370,397,402,429,434,461,466,493,498,
             12,19,44,51,76,83,108,115,140,147,172,179,204,211,236,243,268,275,300,307,332,339,364,371,396,403,428,435,460,467,492,499,
             11,20,43,52,75,84,107,116,139,148,171,180,203,212,235,244,267,276,299,308,331,340,363,372,395,404,427,436,459,468,491,500,
             10,21,42,53,74,85,106,117,138,149,170,181,202,213,234,245,266,277,298,309,330,341,362,373,394,405,426,437,458,469,490,501,
             9,22,41,54,73,86,105,118,137,150,169,182,201,214,233,246,265,278,297,310,329,342,361,374,393,406,425,438,457,470,489,502,
             8,23,40,55,72,87,104,119,136,151,168,183,200,215,232,247,264,279,296,311,328,343,360,375,392,407,424,439,456,471,488,503,
             7,24,39,56,71,88,103,120,135,152,167,184,199,216,231,248,263,280,295,312,327,344,359,376,391,408,423,440,455,472,487,504,
             6,25,38,57,70,89,102,121,134,153,166,185,198,217,230,249,262,281,294,313,326,345,358,377,390,409,422,441,454,473,486,505,
             5,26,37,58,69,90,101,122,133,154,165,186,197,218,229,250,261,282,293,314,325,346,357,378,389,410,421,442,453,474,485,506,
             4,27,36,59,68,91,100,123,132,155,164,187,196,219,228,251,260,283,292,315,324,347,356,379,388,411,420,443,452,475,484,507,
             3,28,35,60,67,92,99,124,131,156,163,188,195,220,227,252,259,284,291,316,323,348,355,380,387,412,419,444,451,476,483,508,
             2,29,34,61,66,93,98,125,130,157,162,189,194,221,226,253,258,285,290,317,322,349,354,381,386,413,418,445,450,477,482,509,
             1,30,33,62,65,94,97,126,129,158,161,190,193,222,225,254,257,286,289,318,321,350,353,382,385,414,417,446,449,478,481,510,
             0,31,32,63,64,95,96,127,128,159,160,191,192,223,224,255,256,287,288,319,320,351,352,383,384,415,416,447,448,479,480,511
            ];


ledPerPacket = ledPerPacket * 2; //.. yeah i know




var processor = {

    timerCallback: function() {
        if (this.video.paused || this.video.ended) {
            return;
        }
        var t0 = performance.now()
        this.sendFrame();
        let self = this;
        setTimeout(function() {
            self.timerCallback();
        }, (1000/maxPps) - (performance.now() - t0) );
    },

    doLoad: function(video) {
        this.video = video; //document.querySelector(".html5-video-container > video");
        this.leds = new Array();
        this.frameseqpos = 0;
        this.lframe = false;

        this.c1 = document.createElement('canvas');
        this.c1.width = WallWidth;
        this.c1.height = WallHeigth;
        this.c1.style.position = "fixed";
        this.c1.style.top = "10vh";
        this.c1.style.zIndex = "9999";
        this.c1.style.width = "160px";
        this.c1.style.imageRendering = "pixelated";
        this.c1.style.imageRendering = "-moz-crisp-edges";
        document.body.appendChild(this.c1);

        this.ctx1 = this.c1.getContext("2d");

        this.c2 = document.createElement('canvas');
        this.c2.width = 256;
        this.c2.height = 144;
        this.c2.style.display="none";
        document.body.appendChild(this.c2);
        this.ctx2 = this.c2.getContext("2d")

        let self = this;

        this.webSocket = this.wsconnect();
        this.video.addEventListener("play", function() {
            self.aspect = self.video.videoWidth / self.video.videoHeight;
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
        fpslog();
        //crop position
        var left = 0;
        var extrawidth = 0;// (this.c1.height * this.aspect) - this.c1.width;
        if (extrawidth > 0) {
            left = (extrawidth / 2) * -1;
        }

        //draw downscaled element to intermediate canvas (downscaling in the process)
        this.ctx2.drawImage(this.video, 0, 0, this.c2.width, this.c2.height );

        //scale,crop and draw to output canvas
        if (resample) {
            var imgdata = resample_single(this.c2, extrawidth + this.c1.width, this.c1.height); //resample from intermediate to final size, slow
            this.ctx1.putImageData(imgdata, left, 0);
        } else {
            this.ctx1.drawImage(this.c2, left, 0,extrawidth + this.c1.width, this.c1.height );
        }

        //send data
        var frame = this.ctx1.getImageData(0, 0, this.c1.width, this.c1.height);
        let l = frame.data.length;
        this.leds = new Array();
        var rgb = new Array();

        //topleft to bottom right
        try {
            for (let i = 0; i < l;) {
                if (this.lframe.data && (frame.data[i] !== this.lframe.data[i] || frame.data[i+1] !== this.lframe.data[i+1] || frame.data[i+2] !== this.lframe.data[i+2])) {
                    rgb[0] = frame.data[i];
                    rgb[1] = frame.data[i+1];
                    rgb[2] = frame.data[i+2];
                    this.leds.push(map[Math.max(0,i / 4)]); //{"seg":{"i":[0,[255,0,0], 1,[0,255,0], 2,[0,0,255]]}}
                    this.leds.push(rgb);
                    rgb = new Array();
                }
                i=i+4;
            }
            this.frameseqpos = 0;
            this.lframe = frame;
        } catch(error) {}
    },

    sendFrame: function() {
        if ( this.frameseqpos < this.leds.length / ledPerPacket && this.leds.length > 0) {
            try {
                //wled cant handle fragmentation, keep packets small enugh
                //todo: byte based split, send first batch without numbering
                var reqpayload = JSON.stringify({
                    "seg": {
                        "i": this.leds.slice(ledPerPacket * this.frameseqpos, ledPerPacket * (this.frameseqpos + 1))
                    }
                });

                this.webSocket.send(reqpayload);
                this.frameseqpos++;

            } catch (error) {
                this.frameseqpos--;
                console.error(error);
            }
        } else {
            this.frameseqpos = 0;
            this.computeFrame();
            this.sendFrame();
        }

    }
};
/**
 * Hermite resize - fast image resize/resample using Hermite filter. 1 cpu version!
 *
 * @param {HtmlElement} canvas
 * @param {int} width
 * @param {int} height
 * @param {boolean} resize_canvas if true, canvas will be resized. Optional.
 */
var resample_single = function(canvas, width, height, resize_canvas) {
    var width_source = canvas.width;
    var height_source = canvas.height;
    width = Math.round(width);
    height = Math.round(height);

    var ratio_w = width_source / width;
    var ratio_h = height_source / height;
    var ratio_w_half = Math.ceil(ratio_w / 2);
    var ratio_h_half = Math.ceil(ratio_h / 2);

    var ctx = canvas.getContext("2d");
    var img = ctx.getImageData(0, 0, width_source, height_source);
    var img2 = ctx.createImageData(width, height);
    var data = img.data;
    var data2 = img2.data;

    for (var j = 0; j < height; j++) {
        for (var i = 0; i < width; i++) {
            var x2 = (i + j * width) * 4;
            var weight = 0;
            var weights = 0;
            var weights_alpha = 0;
            var gx_r = 0;
            var gx_g = 0;
            var gx_b = 0;
            var gx_a = 0;
            var center_y = (j + 0.5) * ratio_h;
            var yy_start = Math.floor(j * ratio_h);
            var yy_stop = Math.ceil((j + 1) * ratio_h);
            for (var yy = yy_start; yy < yy_stop; yy++) {
                var dy = Math.abs(center_y - (yy + 0.5)) / ratio_h_half;
                var center_x = (i + 0.5) * ratio_w;
                var w0 = dy * dy; //pre-calc part of w
                var xx_start = Math.floor(i * ratio_w);
                var xx_stop = Math.ceil((i + 1) * ratio_w);
                for (var xx = xx_start; xx < xx_stop; xx++) {
                    var dx = Math.abs(center_x - (xx + 0.5)) / ratio_w_half;
                    var w = Math.sqrt(w0 + dx * dx);
                    if (w >= 1) {
                        //pixel too far
                        continue;
                    }
                    //hermite filter
                    weight = 2 * w * w * w - 3 * w * w + 1;
                    var pos_x = 4 * (xx + yy * width_source);
                    //alpha
                    gx_a += weight * data[pos_x + 3];
                    weights_alpha += weight;
                    //colors
                    if (data[pos_x + 3] < 255) {
                        weight = weight * data[pos_x + 3] / 250;
                    }
                    gx_r += weight * data[pos_x];
                    gx_g += weight * data[pos_x + 1];
                    gx_b += weight * data[pos_x + 2];
                    weights += weight;
                }
            }
            if (gamma) {
                data2[x2] = Math.round(255 * Math.pow(((gx_r / weights) / 255), gamma));
                data2[x2+1] = Math.round(255 * Math.pow(((gx_g / weights) / 255), gamma));
                data2[x2+2] = Math.round(255 * Math.pow((( gx_b / weights) / 255), gamma));
                data2[x2 + 3] = 255;
            } else {
                data2[x2] = gx_r / weights;
                data2[x2 + 1] =gx_g / weights;
                data2[x2 + 2] = gx_b / weights;
                data2[x2 + 3] = gx_a / weights_alpha;
            }
        }
    }

    return img2;
}
var lastCalledTime;
var counter = 0;
var fpsArray = [];

function fpslog() {
    var fps;

    if (!lastCalledTime) {
        lastCalledTime = new Date().getTime();
        fps = 0;
    }

    var delta = (new Date().getTime() - lastCalledTime) / 1000;
    lastCalledTime = new Date().getTime();
    fps = Math.ceil((1/delta));

    if (counter >= 60) {
        var sum = fpsArray.reduce(function(a,b) { return a + b });
        var average = Math.ceil(sum / fpsArray.length);
        console.log(average);
        counter = 0;
    } else {
        if (fps !== Infinity) {
            fpsArray.push(fps);
        }

        counter++;
    }
}

//todo
/*
poll for video element
for each element found add classname menu item

if menu contains items display list in overlay
on click item start capturing it
*/
var checkExist = setInterval(function() {
    if (document.getElementsByTagName('video').length) {
        console.log("Exists!");
        clearInterval(checkExist);


        var videos = document.getElementsByTagName('video');
        //videos[0].crossOrigin="anonymous";
        console.log(videos[0]);
        processor.doLoad(videos[0]);
    }
}, 1000);



