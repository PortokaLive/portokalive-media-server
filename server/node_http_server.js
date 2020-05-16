//
//  Created by Mingliang Chen on 17/8/1.
//  illuspas[a]gmail.com
//  Copyright (c) 2018 Nodemedia. All rights reserved.
//

const Fs = require("fs");
const path = require("path");
const Http = require("http");
const Https = require("https");
const WebSocket = require("ws");
const Express = require("express");
const bodyParser = require("body-parser");
const basicAuth = require("basic-auth-connect");
const NodeFlvSession = require("./node_flv_session");
const NodeSseServer = require("./node_sse_server");
const HTTP_PORT = 80;
const HTTPS_PORT = 443;
const HTTP_MEDIAROOT = "./media";
const Logger = require("./node_core_logger");
const context = require("./node_core_ctx");

const streamsRoute = require("../api/routes/streams");
const serverRoute = require("../api/routes/server");
const relayRoute = require("../api/routes/relay");
const { checkAuth } = require("./node_core_utils");

class NodeHttpServer {
  constructor(config) {
    this.port = config.http.port || HTTP_PORT;
    this.mediaroot = config.http.mediaroot || HTTP_MEDIAROOT;
    this.config = config;

    let app = Express();

    app.use(bodyParser.urlencoded({ extended: true }));

    app.all("*", (req, res, next) => {
      res.header("Access-Control-Allow-Origin", this.config.http.allow_origin);
      res.header(
        "Access-Control-Allow-Headers",
        "Content-Type,Content-Length, Authorization, Accept,X-Requested-With"
      );
      res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
      res.header("Access-Control-Allow-Credentials", true);
      req.method === "OPTIONS" ? res.sendStatus(200) : next();
    });

    app.get("*.flv", (req, res, next) => {
      req.nmsConnectionType = "http";
      this.onConnect(req, res);
    });

    if (this.config.http.api !== false) {
      app.use(["/api/*"], checkAuth);

      const auth = {
        username: this.config.auth.api_user,
        password: this.config.auth.api_pass,
      };
      const sseServer = new NodeSseServer();
      sseServer.initAuth(auth, this.port);

      app.use("/api/streams", streamsRoute(context));
      app.use("/api/server", serverRoute(context));
      app.use("/api/relay", relayRoute(context));
      app.use("/sse/streams", (req, res) => {
        res.writeHead(200, {
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        });
        sseServer.emitStreamInfo(req).then((result) => {
          res.write(result);
        });

        context.nodeEvent.on("postPublish", (id, args) => {
          sseServer.emitStreamInfo(req).then((result) => {
            res.write(result);
          });
        });
        context.nodeEvent.on("postPlay", (id, args) => {
          sseServer.emitStreamInfo(req).then((result) => {
            res.write(result);
          });
        });
        context.nodeEvent.on("donePublish", (id, args) => {
          sseServer.emitStreamInfo(req).then((result) => {
            res.write(result);
          });
        });
        context.nodeEvent.on("donePlay", (id, args) => {
          sseServer.emitStreamInfo(req).then((result) => {
            res.write(result);
            res.flush();
          });
        });
      });
    }

    app.use(Express.static(path.join(__dirname,"../static")));
    app.use(Express.static(this.mediaroot));
    if (config.http.webroot) {
      app.use(Express.static(config.http.webroot));
    }

    this.httpServer = Http.createServer(app);

    /**
     * ~ openssl genrsa -out privatekey.pem 1024
     * ~ openssl req -new -key privatekey.pem -out certrequest.csr
     * ~ openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem
     */
    if (this.config.https) {
      let options = {
        key: Fs.readFileSync(this.config.https.key),
        cert: Fs.readFileSync(this.config.https.cert),
      };
      this.sport = config.https.port ? config.https.port : HTTPS_PORT;
      this.httpsServer = Https.createServer(options, app);
    }
  }

  run() {
    this.httpServer.listen(this.port, () => {
      Logger.log(`Node Media Http Server started on port: ${this.port}`);
    });

    this.httpServer.on("error", (e) => {
      Logger.error(`Node Media Http Server ${e}`);
    });

    this.httpServer.on("close", () => {
      Logger.log("Node Media Http Server Close.");
    });

    this.wsServer = new WebSocket.Server({ server: this.httpServer });

    this.wsServer.on("connection", (ws, req) => {
      req.nmsConnectionType = "ws";
      this.onConnect(req, ws);
    });

    this.wsServer.on("listening", () => {
      Logger.log(`Node Media WebSocket Server started on port: ${this.port}`);
    });
    this.wsServer.on("error", (e) => {
      Logger.error(`Node Media WebSocket Server ${e}`);
    });

    if (this.httpsServer) {
      this.httpsServer.listen(this.sport, () => {
        Logger.log(`Node Media Https Server started on port: ${this.sport}`);
      });

      this.httpsServer.on("error", (e) => {
        Logger.error(`Node Media Https Server ${e}`);
      });

      this.httpsServer.on("close", () => {
        Logger.log("Node Media Https Server Close.");
      });

      this.wssServer = new WebSocket.Server({ server: this.httpsServer });

      this.wssServer.on("connection", (ws, req) => {
        req.nmsConnectionType = "ws";
        this.onConnect(req, ws);
      });

      this.wssServer.on("listening", () => {
        Logger.log(
          `Node Media WebSocketSecure Server started on port: ${this.sport}`
        );
      });
      this.wssServer.on("error", (e) => {
        Logger.error(`Node Media WebSocketSecure Server ${e}`);
      });
    }

    context.nodeEvent.on("postPlay", (id, args) => {
      context.stat.accepted++;
    });

    context.nodeEvent.on("postPublish", (id, args) => {
      context.stat.accepted++;
    });

    context.nodeEvent.on("doneConnect", (id, args) => {
      let session = context.sessions.get(id);
      let socket =
        session instanceof NodeFlvSession ? session.req.socket : session.socket;
      context.stat.inbytes += socket.bytesRead;
      context.stat.outbytes += socket.bytesWritten;
    });
  }

  stop() {
    this.httpServer.close();
    if (this.httpsServer) {
      this.httpsServer.close();
    }
    context.sessions.forEach((session, id) => {
      if (session instanceof NodeFlvSession) {
        session.req.destroy();
        context.sessions.delete(id);
      }
    });
  }

  onConnect(req, res) {
    let session = new NodeFlvSession(this.config, req, res);
    session.run();
  }
}

module.exports = NodeHttpServer;
