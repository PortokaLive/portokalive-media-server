const NodeMediaServer = require('./node_media_server');
const dotenv = require("dotenv");

dotenv.config();

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    mediaroot: './media',
    webroot: './www',
    allow_origin: '*',
    api: true
  },
  auth: {
    api: true,
    play: false,
    publish: false,
  },
};


let nms = new NodeMediaServer(config)
nms.run();
