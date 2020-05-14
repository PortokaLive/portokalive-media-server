const axios = require("axios");

class NodeSseServer {
  initAuth(auth, port) {
    this.auth = auth;
    this.port = port;
  }

  async fetchAxios() {
    const result = await axios.get(
      `http://localhost:${this.port}/api/streams`,
      {
        auth: this.auth,
      }
    );
    return result.data;
  }

  async emitStreamInfo() {
    const resp = await this.fetchAxios();
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
