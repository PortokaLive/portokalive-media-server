const NodeMediaServer = require('./node_media_server');

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
    api_user: 'portoka.live',
    api_pass: 'portoka.live140295$',
    play: false,
    publish: false,
    secret: 'portoka.live140295$',
    sseKey: '4Jp2Q3RyIu'
  },
};


let nms = new NodeMediaServer(config)
nms.run();
