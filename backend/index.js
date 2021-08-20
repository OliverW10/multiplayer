const http = require("http");
const ws = require("ws");

const wsPort = 8080;

// ========== WEB SOCKETS ==========

const wss = new ws.Server({ noServer: true });

function accept(req, res) {
  // all incoming requests must be websockets
  if (
    !req.headers.upgrade ||
    req.headers.upgrade.toLowerCase() != "websocket"
  ) {
    res.end();
    return;
  }

  // can be Connection: keep-alive, Upgrade
  if (
    !(
      req.headers.connection.match(/\bupgrade\b/i) ||
      req.headers.connection.match(/\bkeep-alive\b/i)
    )
  ) {
    res.end();
    return;
  }

  wss.handleUpgrade(req, req.socket, Buffer.alloc(0), onConnect);
}

class Client {
  constructor(wSocket, id) {
    this.socket = wSocket;
    this.id = id;
    this.lastPing = Date.now();
    this.public = false;
  }
  send(messageObj) {
    this.socket.send(JSON.stringify(messageObj));
  }
  alive(timeoutMax = 5000) {
    return this.lastPing > Date.now() - timeoutMax;
  }
  close() {}
}

let clients = [];
const randomId = (size = 3) =>
  Math.floor(
    Math.random() * (10 ** size - 10 ** (size - 1)) + 10 ** (size - 1)
  );
function getNewClientId() {
  let n = 0;
  let id = randomId(); // random number thats size digits long
  while (clients.some((x) => x.id === id)) {
    id = randomId; // random number thats size digits long
    n++;
    if (n > 10 ** (size + 1)) {
      console.log("out of ids or really unlucky");
      return -2;
    }
  }
  return id;
}

function getClientFromId(id) {
  for (let client of clients) {
    if (client.id === id) {
      return client;
    }
  }
}
function getClientFromWs(ws) {
  for (let client of clients) {
    if (client.socket === ws) {
      return client;
    }
  }
  console.log(`couldnt find client ${ws} in ${clients}`);
}

// when a new client connects
function onConnect(ws) {
  // create a client class for them to hold their socket
  clients.push(new Client(ws, getNewClientId()));
  console.log(`client connected`);

  // add callback to fire on message
  ws.on("message", function (message) {
    try {
      var messageObj = JSON.parse(message.toString());
    } catch {
      console.log(`!!!!!!!!!!! ^^ that wasnt json !!!!!!!!!!!!!!!`);
      return;
    }
    if (messageObj.type != "ping") {
      console.log(`message recived: ${message.toString()}`);
    }

    switch (messageObj.type) {
      case "get-id":
        console.log(`got id ${JSON.stringify({ id: getClientFromWs(ws).id })}`);
        ws.send(
          JSON.stringify({ type: "give-id", data: getClientFromWs(ws).id })
        );
        break;
      case "list-games":
        let pubClients = clients.filter((c) => c.public);
        ws.send(
          JSON.stringify({
            type: "games-list",
            data: pubClients.map((c) => c.id),
          })
        );
        break;
      case "rtc-signal": // routes the message to the correct id
        let destId = messageObj.data.dst;
        let destClient = getClientFromId(destId);
        if (destClient) {
          destClient.send(messageObj);
        } else {
          console.log("recived invalid client");
        }
        break;
      case "ping":
        let c = getClientFromWs(ws); // have to get client so you can set its lastPing time
        if (c) {
          c.lastPing = Date.now();
          ws.send(JSON.stringify({ type: "pong" }));
        } else {
          console.log("got ping from invalid client, creating new one");
          let newId = getNewClientId();
          clients.push(new Client(ws, newId));
          ws.send(JSON.stringify({ type: "give-id", data: newId }));
        }
        break;
      case "change-game":
        getClientFromWs(ws).public = messageObj.data;
    }
  });
}

function pruneClients() {
  // remove inactive clients
  let start_len = clients.length;
  clients = clients.filter((c) => c.alive());
  if (clients.length - start_len != 0) {
    console.log(
      `pruned clients ${clients.length} (${clients.length - start_len})`
    );
  }
}

setInterval(pruneClients, 5000);

if (!module.parent) {
  http.createServer(accept).listen(wsPort);
} else {
  exports.accept = accept;
}
