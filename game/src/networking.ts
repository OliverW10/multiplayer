// https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking
// https://raymondgh.github.io/webrtc.html

import { playerAction, playerState } from "./player";
import { Game, Map } from "./game.js"
// interface wsInterface{
//   type: ;
//   data: RTCSignal | number;
// }

interface NetworkParent{
  onPeerMsg: (msg: peerInterface)=>void;
  onNewPeer: (id: number)=>void;
}

interface mapMessage {
  type: "world-data";
  data: Map;
}

interface stateMessage {
  type: "game-state";
  data: gameState;
}

export type peerInterface = mapMessage | stateMessage;

interface gameState {
  playerStates?: Array<playerState>
  playerActions?: Array<playerAction>
}



interface RTCDataSignal {
  src: number;
  dst: number;
  messageType: 'data-offer' | 'data-answer';
  sessionDescription: RTCSessionDescriptionInit;
}
interface RTCIceSignal {
  src: number;
  dst: number;
  messageType: 'ice-candidate';
  candidate: RTCIceCandidate;
}
type RTCSignal = RTCIceSignal | RTCDataSignal;


class Peer {
  peerConnection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  id: number; // id is the id for the remote
  localId: number; // local id is the id of this peer
  ready: boolean = false; // ready to send p2p messages
  wsSender: (message: RTCSignal) => void;
  parent: NetworkParent;

  constructor(id: number, localId: number, signaler: (message: RTCSignal) => void, parent: NetworkParent) {
    this.peerConnection = new RTCPeerConnection();
    this.id = id;
    this.localId = localId;
    this.wsSender = signaler;
    this.parent = parent;

    // first set callbacks for once data channel is open
    // once data channel is created this is called
    this.peerConnection.ondatachannel = event => {
      this.dataChannel = event.channel;
      console.log("on data channel called")
      this.setDatachannelCallbacks()
    }

    // triggered by setting local description
    // create and send ice candidate
    this.peerConnection.onicecandidate = (event) => {
      // onicecandidates keep coming until an empty event is passed
      // console.log(`event given to onicecandidate ${JSON.stringify(event)}`)
      if (event.candidate) {
        // prepare a message to send to peer 2
        let message: RTCIceSignal = {
          src: this.localId,
          dst: this.id,
          messageType: 'ice-candidate',
          candidate: event.candidate
        };

        console.log("ice candidate generated and send")
        this.wsSender(message);
      } else {
        // no more candidates to send
        console.log("All ICE candidates sent!")
      }
    }
  }

  private setDatachannelCallbacks() {
    console.log(`set data channel callbacks ${this.dataChannel}`)
    if (this.dataChannel) { // checks if its not null
      // some data channel handlers for peer 1
      this.dataChannel.onopen = event => {
        console.log("All set!");
        this.ready = true;
      }

      this.dataChannel.onclose = event => {
        console.log("P1: Hey, my data channel was closed!");
      }

      this.dataChannel.onmessage = event => {
        console.log("P1: I just got this message:");
        console.log(event.data);
        this.parent.onPeerMsg(JSON.parse(event.data))
      }
    }
  }

  public sendString(data: string) {
    if (this.ready && this.dataChannel) {
      this.dataChannel!.send(data);
    } else {
      console.log("tried to send before ready")
      console.log(this)
    }
  }
  public sendObject(object: any) {
    this.sendString(JSON.stringify(object))
  }

  public createDataOffer() {
    this.dataChannel = this.peerConnection.createDataChannel("myFirstDataChannel")
    this.peerConnection.createOffer().then((OfferRTCSessionDescription) => {
      // peer1, the offerer, will set the offer to be its Local Description
      // setting Local Description triggers the peer1connection.onicecandidate event!!
      this.peerConnection!.setLocalDescription(OfferRTCSessionDescription);

      // Prepare a message to send to peer 2
      let message: RTCDataSignal = {
        src: this.localId!,
        dst: this.id,
        messageType: 'data-offer',
        sessionDescription: OfferRTCSessionDescription
      };
      console.log(OfferRTCSessionDescription)

      // send OfferRTCSessionDescription to peer2 via signaling server
      // this.socket.send(JSON.stringify({type:"rtc-signal", signal:message}));
      this.wsSender(message)

      this.setDatachannelCallbacks()
    })
  }

  // handle offer, means someones trying to join us
  public handleDataOffer(message: RTCDataSignal) {
    this.peerConnection.setRemoteDescription(message.sessionDescription);

    // then create the response
    this.peerConnection.createAnswer().then((AnswerRTCSessionDescription) => {
      console.log("created answer")
      // set the localdescription as the answer
      // setting Local Description triggers the peer2connection.onicecandidate event!!
      this.peerConnection.setLocalDescription(AnswerRTCSessionDescription);

      // Prepare a message to send to peer 2
      let answer: RTCDataSignal = {
        src: message.dst,
        dst: message.src,
        messageType: 'data-answer',
        sessionDescription: AnswerRTCSessionDescription,
      };
      this.wsSender(answer);
    })
  }

  // when we recive a data answer just set it as description, onicecandidate will be called soon
  public handleDataAnswer(message: RTCDataSignal) {
    this.peerConnection.setRemoteDescription(message.sessionDescription);
  }


  public handleIceCandidate(message: RTCIceSignal) {
    // get the candidate from the message
    let candidate = new RTCIceCandidate(message.candidate);

    // add the ice candidate to the connection
    // will automatically call onicecandidate again if it dosent work
    this.peerConnection!.addIceCandidate(candidate).then(() =>
      // it worked!
      console.log('Ice Candidate successfully added to peerconnection'),
      // it didn't work!
      err => {
        console.log('PR 1: Oh no! We failed to add the candidate');
        console.log("Here's the error:", err);
      });
  }
}


var pingTime = Date.now();

export class Networking {
  wsServer: string = "ws://localhost:8080"
  socket: WebSocket;
  peers: Array<Peer> = []; // a host peer will have every peer in the game but a client will only connect to the host
  id?: number;
  gamesList: Array<number> = [];
  onGameList: (list: Array<number>) => void; // intended to be overridden
  // onPeerMsg: (message: peerInterface) => void;
  // onNewPeer: (id: number)=>void;
  visable: boolean = false;
  hosting: boolean = false; // wether we are the host of the game
  connected: boolean = false; // in a game rn
  parent: NetworkParent;

  // constructor used to setup websockets connection with server
  constructor(parent: NetworkParent) {
    // onPeerMsg: (message: peerInterface) => void, onNewPeer: (id: number)=>void // old
    this.parent = parent
    this.socket = new WebSocket(this.wsServer)
    this.socket.onopen = (e) => {
      console.log("server connection opened");
      this.wsSend("get-id"); // request an id as soon as the connection opens
      setInterval(() => { this.wsSend("ping"); pingTime = performance.now()}, 2000) // ping server to keep connection alive and server know if client still there
    };

    // callbacks for server message
    this.socket.onmessage = (event) => {
      try {
        var msgObj = JSON.parse(event.data); // assumes its json
      } catch {
        console.log("recived non-json from server")
        return;
      }
      if (msgObj.type == "give-id") {
        this.id = msgObj.data;
        console.log(`got id: ${this.id}`)
        this.wsSend("list-games")
      }
      if (msgObj.type == "games-list") {
        this.gamesList = msgObj.data;
        console.log(`got games list: ${this.gamesList}`)
        this.onGameList(this.gamesList);
      }
      if (msgObj.type == "pong") {
        // this.socket.send(JSON.stringify({ping: true}))
        // console.log("recived pong")
      }
      if (msgObj.type == "rtc-signal") {
        this.signalHandler(msgObj.data)
      }
    };

    this.socket.onclose = function (event) {
      if (event.wasClean) {
        console.log(`[close] WS Connection closed cleanly, code=${event.code} reason=${event.reason}`);
      } else {
        // e.g. server process killed or network down
        // event.code is usually 1006 in this case
        console.log('[close] WS Connection died');
      }
    };
    this.socket.onerror = function (error) {
      console.log(`websocket error: ${error}`)
      alert(`[WS error] ${error}`);
    };

    this.onGameList = () => { }; // just a placeholder, real callback is passes in call to this.getGames
  }

  // either gets the existing remote with that id or creates one
  private remoteFromId(id: number, dontCreate = false): Peer {
    let temp = this.peers.filter(x => x.id == id) // filters only remotes with current id
    if (temp.length >= 1) {
      return temp[0]
    } else {
      if (dontCreate) {
        throw "ID dosent exist"
      }
      const signaler = (response: RTCSignal) => { this.wsSend("rtc-signal", response)}
      let newRemote = new Peer(id, this.id!, signaler, this.parent);
      this.peers.push(newRemote);
      return this.peers[this.peers.length - 1];
    }
  }

  // handles any WS messages with type 'rtc-signal'
  private signalHandler(signal: RTCSignal) {

    let curRemote = this.remoteFromId(signal.src); // gets or creates remote with correct id

    console.log("handling signal")
    // call its handle function for this type of message
    switch (signal.messageType) {
      case "data-offer": // someone is trying to join us
        if(this.connected){ // already in a game
          if(this.hosting){ // we are the host
            curRemote.handleDataOffer(signal)
          }else{ // not host
            console.log("someone tried to join us, not a host")
          }
        }else{ // not already in a game
          this.hosting = true;
          curRemote.handleDataOffer(signal)
        }
        this.connected = true;
        break;
      case "data-answer":
        this.hosting = false;
        this.connected = true;
        console.log("it was a data answer")
        curRemote.handleDataAnswer(signal)
        break;
      case "ice-candidate":
        console.log("it was a ice candidate")
        curRemote.handleIceCandidate(signal)
        break;
      default:
        console.log("invalid signal recived")
    }
  }

  // to create a p2p connection to gameId
  public joinGame(gameId: number): void {
    // clears previos connections
    this.peers = [];
    // sends initial RTC data-offer message to connect
    if (!this.id) { console.log("tried to join a game before getting id"); return }
    this.hosting = false;
    this.visable = false;
    let curRemote = this.remoteFromId(gameId);
    curRemote.createDataOffer()
  }

  // send data to server
  public wsSend(
    type: "get-id" | "give-id" | "list-games" | "change-game" | "join-game" | "rtc-signal" | "ping",
    data?: RTCSignal | number | boolean
  ) {
    this.socket.send(JSON.stringify({ type: type, data: data }))
  }

  // send data to all or some peers peers
  public rtcSendString(data: string, target = -1) {
    // set target to -1 to send to all peers
    if (target == -1) {
      for (let p of this.peers) {
        p.sendString(data)
      }
    } else {
      this.remoteFromId(target).sendString(data)
    }
  }

  public rtcSendObj(data: any, target = -1){
    this.rtcSendString(JSON.stringify(data), target)
  }

  public getGames(callback: (list: Array<number>) => void) {
    this.wsSend("list-games")
    this.onGameList = callback;
  }

  public setVis(set: boolean): void{
    // sets game visability
    this.visable = set;
    this.wsSend("change-game", this.visable)
  }

  public toggleVis(): boolean{
    this.setVis(!this.visable)
    return this.visable;
  }
}