const http = require("http");
const ws = require("ws");

const port = 8080;

const wss = new ws.Server({ noServer: true });

function accept(req, res) {
  // all incoming requests must be websockets
  if (
    !req.headers.upgrade ||
    req.headers.upgrade.toLowerCase() != "websocket"
  ) {
    acceptHttp(res)
    return;
  }

  // can be Connection: keep-alive, Upgrade
  if (
    !(
      req.headers.connection.match(/\bupgrade\b/i) ||
      req.headers.connection.match(/\bkeep-alive\b/i)
    )
  ) {
    acceptHttp(res)
    res.end();
    return;
  }

  acceptWs(req)
}

function acceptHttp(res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write(`Connected: ${clients.length}`);
  res.end();
}

function acceptWs(req){
  wss.handleUpgrade(req, req.socket, Buffer.alloc(0), onConnect);
}

class Client {
  constructor(wSocket, id) {
    this.socket = wSocket;
    this.id = id;
    this.lastPing = Date.now();
    this.public = false;
    this.name = "gameName";
    this.playerNum = 1;
    this.gameMode = "pvp";
  }
  send(messageObj) {
    this.socket.send(JSON.stringify(messageObj));
  }
  alive(timeoutMax = 10000) {
    return this.lastPing > Date.now() - timeoutMax;
  }
  getObj(){
    return {
      id: this.id,
      name: this.name,
      players: this.playerNum,
      mode: this.gameMode,
    }
  }
}

// generates random number [min, max)
function randRange(min, max){
    return Math.floor(Math.random()*(max-min)+min);
}

const ID_BASE = 10;
let clients = [];
// size in hex
function getNewClientId(size=3) {
  max = ID_BASE**(size+1) -1;
  min = ID_BASE**size;
  let n = 0;
  let id = randRange(min, max); // random number thats size digits long
  while (clients.some((x) => x.id === id)) {
    id = randRange(min, max); // random number thats size digits long
    n++;
    if (n > max*5) {
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

function getGamesList(){
  let pubClients = clients.filter((c) => c.public);
  return pubClients.map((c) => c.getObj())
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
      console.log(`!!!!!!!!!!! didnt get json !!!!!!!!!!!!!!!`);
      return;
    }
    if (messageObj.type != "ping") {
      console.log(`message recived: ${message.toString()}`);
    }

    // "get-id" | "list-games" | "set-game-vis" | "rtc-signal" | "ping" | "set_name" | "set_players"
    switch (messageObj.type) {
      case "get-id":
        console.log(`got id ${JSON.stringify({ id: getClientFromWs(ws).id })}`);
        ws.send(
          JSON.stringify({ type: "give-id", data: getClientFromWs(ws).id })
        );
        break;
      case "list-games":
        ws.send( JSON.stringify({
            type: "games-list",
            data: getGamesList()
        }));
        break;
      case "rtc-signal": // routes the message to the correct id
      case "passthrough":
      case "passthrough-signal":
        // code runs for both cases
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
      case "set-game-vis":
        getClientFromWs(ws).public = messageObj.data;
        ws.send( JSON.stringify({
            type: "games-list",
            data: getGamesList()
        }));
        break;
      case "set-name":
        getClientFromWs(ws).name = messageObj.data;
        ws.send( JSON.stringify({
            type: "games-list",
            data: getGamesList()
        }));
        break;
      case "set-name":
        getClientFromWs(ws).playerNum = messageObj.data;
        ws.send( JSON.stringify({
            type: "games-list",
            data: getGamesList()
        }));
        break;
      case "set-mode":
        getClientFromWs(ws).gameMode = messageObj.data;
        ws.send( JSON.stringify({
            type: "games-list",
            data: getGamesList()
        }));
        break;
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

setInterval(pruneClients, 1000);

http.createServer(accept).listen(port);

