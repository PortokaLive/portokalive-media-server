const axios = require("axios");

class NodeSseServer {
  initAuth(auth, port) {
    this.auth = auth;
    this.port = port;
  }

  async fetchAxios(req) {
    const result = await axios
      .get(
        `http://localhost:${this.port}/api/streams?token=${
          req.query.token || ""
        }`
      )
      .catch((err) => {
        return err;
      });
    return result.data;
  }

  async emitStreamInfo(req) {
    const resp = await this.fetchAxios(req);
    if (!resp) {
      return "data: Unable to fetch streams\n\n";
    }
    if (resp.live) {
      const live = Object.values(resp.live);
      const streamObjects = live.map((v) => {
        return { publisher: v.publisher.stream, subscribers: v.subscribers };
      });
      return `data: ${JSON.stringify(streamObjects)}\n\n`;
    } else {
      return `data: []\n\n`;
    }
  }
}

module.exports = NodeSseServer;
