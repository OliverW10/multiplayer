// https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking
// https://raymondgh.github.io/webrtc.html

import { gameType, UiMessage, UiMessageTypes } from ".";
import { Peer } from "./networkPeer";
import { playerData } from "./player";
import { Vector2 } from "./utils";


const WS_SERVER = "wss://multiplayer-backend.olikat.repl.co"


interface mapMessage {
    type: "world-data";
    data: number; // seed
}

export interface playerStateMessage { // send from host to clients
    // gives out athorative positions of all players to each client, dosent contain all players, just nearby ones
    type: "game-state";
    data: Array<playerData>;
    frame: number;
}

export interface playerInputMessage { // send from clients to host
    type: "player-input";
    data: {
        inputY: number,
        inputX: number,
        lookAngle: number;
        // all action input are optional to save data, assumed false when not present
        swingPos?: Vector2,
        shooting?: boolean,
        detonating?: boolean,
        noMap?: boolean,
        noTime?: boolean,
    },
}

export interface pong {
    type: "pong";
    frame: number;
}

export type peerInterface = mapMessage | playerInputMessage | playerStateMessage | pong;

export interface gameInfo{
    id: number;
    name: string;
    players: number;
    slots?: number;
    mode: gameType;
}


export interface RTCDataSignal {
    src: number;
    dst: number;
    messageType: 'data-offer' | 'data-answer';
    sessionDescription: RTCSessionDescriptionInit;
}
export interface RTCIceSignal {
    src: number;
    dst: number;
    messageType: 'ice-candidate';
    candidate: RTCIceCandidate;
}

type RTCSignal = {
    type: "rtc-signal"
    data: RTCIceSignal | RTCDataSignal,
}
type getIdMsg = {type: "get-id"}
type setGameVisMsg = {
    type: "set-game-vis",
    data: boolean
}
type pingMsg = {type: "ping"}
type setNameMsg = {
    type:"set-name",
    data: string
}
type setPlayersMsg = {
    type:"set-players",
    data: number
}
type setModeMsg = {
    type: "set-mode",
    data: gameType
}
type passthroughMsg = {
    type: "passthrough",
    data: {
        src: number,
        dst: number,
        message: peerInterface
    }
}
type passthroughSignalMsg = {
    type: "passthrough-signal",
    data: {
        src: number,
        dst: number,
        type: "offer"|"accept"|"refuse"
    }
}
type listGamesMsg = {
    type: "list-games"
}

// message to be sent from browser to server
export type wsMessageSend = RTCSignal | getIdMsg | setGameVisMsg | pingMsg | setNameMsg | setPlayersMsg | setModeMsg | passthroughMsg | listGamesMsg | passthroughSignalMsg;

type giveIdMsg = {
    type: "give-id",
    data: number,
}
type gameListMsg = {
    type: "games-list",
    data: Array<gameInfo>,
}
type pongMsg ={
    type: "pong"
}

//  message send from server to browser
type wsMessageRecive = RTCSignal | passthroughMsg | giveIdMsg | gameListMsg | pongMsg | passthroughSignalMsg;





class Networking {
    socket: WebSocket;
    peers: Array<Peer> = []; // a host peer will have every peer in the game but a client will only connect to the host
    id?: number;
    gamesList: Array<gameInfo> = [];

    // intended to be overridden
    onGameList: (list: Array<gameInfo>) => void;
    onPeerMsg: (message: peerInterface, id: number) => void = (x) => { }; // is game onMessage when a client and gameHosts onmessage when host
    onHostClientMsg: (message: peerInterface, id: number) => void = (x) => { }; // for host sending message to its local client
    onNewPeer: (id: number) => void = (x) => { };
    onPeerLeave: (id: number) => void = (x) => { };
    onServerOpen: () => void = () => { };
    uiCallback: (msgType: UiMessage, data?: any)=>void = (e)=>{};
    visable: boolean = false;
    hosting: boolean = false; // wether we are the host of the game
    connected: boolean = false; // in a game rn
    pingTime: number = performance.now()

    // constructor used to setup websockets connection with server
    constructor() {
        this.socket = new WebSocket(WS_SERVER)
        this.socket.onopen = (e) => {
            console.log("server connection opened");
            this.onServerOpen();
            this.wsSend({type:"get-id"}); // request an id as soon as the connection opens
            setInterval(() => { this.wsSend({type:"ping"}); this.pingTime = performance.now() }, 2000) // ping server to keep connection alive and server know if client still there
        };

        // callbacks for server message
        this.socket.onmessage = (event) => {
            try {
                var msgObj: wsMessageRecive = JSON.parse(event.data); // assumes its json
            } catch {
                console.log("recived non-json from server")
                return;
            }
            if (msgObj.type == "give-id") {
                this.id = msgObj.data;
                console.log(`got id: ${this.id}`)
                this.wsSend({type:"list-games"})
            }
            if (msgObj.type == "games-list") 
            {
                const createGameObj = (data: any): gameInfo=>{
                    return {id: data.id, name: data.name, players:data.players, mode:data.mode==="pvp"?gameType.pvp:gameType.race}
                }
                this.gamesList = msgObj.data.map(createGameObj);
                this.onGameList(this.gamesList);
            }
            if (msgObj.type == "pong") {
                // this.socket.send(JSON.stringify({ping: true}))
                // console.log("recived pong")
            }
            if (msgObj.type == "rtc-signal") {
                this.signalHandler(msgObj.data)
            }
            if(msgObj.type == "passthrough"){
                if(this.hosting){

                }
                this.onPeerMsg(msgObj.data.message, msgObj.data.src)
            }
            if(msgObj.type == "passthrough-signal"){
                this.passthroughSignalHandler(msgObj)
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
            alert(`Server is starting up, please try again in a few seconds. ${error}`);
        };

        this.onGameList = () => { }; // just a placeholder, real callback is passed in call to this.getGames
        this.onPeerLeaveWrapper = this.onPeerLeaveWrapper.bind(this);
        this.wsSend = this.wsSend.bind(this);
    }

    public setOnPeerMsg(func: (msg: peerInterface, id: number) => void) {
        this.onPeerMsg = func;
        for (let p of this.peers) {
            p.onPeerMsg = func;
        }
    }
    public setOnHostClientMsg(func: (msg: peerInterface, id: number) => void) {
        this.onHostClientMsg = func;
    }

    public setOnNewPeer(func: (id: number) => void): void {
        this.onNewPeer = func;
        for (let p of this.peers) {
            // wraps the given func to also set connected to true
            p.onPeerReady = (id: number)=>{this.connected = true; func(id)};
        }
    }

    public setOnPeerLeave(func: (id: number) => void): void {
        this.onPeerLeave = func;
        for (let p of this.peers) {
            p.leaveCallback = this.onPeerLeaveWrapper;
        }
    }

    public setUiMessage(uiCallback: (msgType: UiMessage, data?: any)=>void){
        this.uiCallback = uiCallback;
    }

    onPeerLeaveWrapper(id: number) {
        this.peers.filter(p => p.id !== id) // removes peer from peer list
        console.log(`removed peer with id ${id}`)
        this.onPeerLeave(id) // calls given callback func
    }

    // either gets the existing remote with that id or creates one
    private remoteFromId(id: number, dontCreate = false): Peer {
        let temp = this.peers.filter(x => x.id == id) // filters only remotes with current id
        if (temp.length >= 1) {
            return temp[0]
        } else {
            if (dontCreate) {
                throw "ID dosent exist"
            }else{
                let newPeer = new Peer(id, this.id!, this.wsSend, this.onPeerMsg, this.onNewPeer, this.onPeerLeave);
                this.peers.push(newPeer);
                console.log("new peer")
                return this.peers[this.peers.length-1]
            }
        }
    }

    // handles any WS messages with type 'rtc-signal'
    private signalHandler(signal: RTCDataSignal | RTCIceSignal) {

        let curRemote = this.remoteFromId(signal.src); // gets or creates Peer with correct id

        console.log("handling signal")
        // call its handle function for this type of message
        switch (signal.messageType) {
            case "data-offer": // someone is trying to join us
                if (this.connected) { // already in a game
                    if (this.hosting) { // we are the host
                        curRemote.handleDataOffer(signal)
                    } else { // not host
                        console.log("someone tried to join us, not a host")
                    }
                } else { // not already in a game
                    this.hosting = true;
                    curRemote.handleDataOffer(signal)
                }
                break;
            case "data-answer": // comfirmed we can join somone, ice candidates start getting generated soon
                this.hosting = false;
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

    private passthroughSignalHandler(signal: passthroughSignalMsg){
        let curRemote = this.remoteFromId(signal.data.src); // gets or creates Peer with correct id

        if(signal.data.type == "offer"){
            console.log("got passthrough offer")
            if(this.connected && !this.hosting){ // someone offered to join us but were already in a game and not the host
                this.wsSend({type:"passthrough-signal", data:{
                    src: signal.data.dst,
                    dst: signal.data.src,
                    type:"refuse"
                }})
                console.log(`refused connected${this.connected}   hosting${this.hosting}`)
            }else{
                // if either we're not in a game or were in a game and hosting
                this.hosting = true;
                console.log("accepting passthrough offer")
                this.wsSend({type:"passthrough-signal", data:{
                    src: signal.data.dst,
                    dst: signal.data.src,
                    type:"accept"
                }})
                curRemote.setUsingPassthrough() // let peer know its redundant
            }
        }
        if(signal.data.type == "accept"){
            console.log("got passthrough accept")
            curRemote.setUsingPassthrough()
        }
        if(signal.data.type == "refuse"){
            // show ui message saying cant join
        }
    }

    // tries to create a p2p connection to gameId
    public joinGame(gameId: number): void {
        console.log(`trying to join game ${gameId}`)
        if(!this.gamesList.some((info=>info.id===gameId))){
            console.log("joining private game"); // allows this
        }
        if(gameId === this.id){
            throw "Tried to join ourselves"
        }
        if(!this.id){
            throw "Tried to join before getting our id"
        }
        // clears previous connections
        this.peers = [];
        // sends initial RTC data-offer message to connect
        this.hosting = false;
        this.uiCallback({ type: UiMessageTypes.setHosting, data: false })
        this.setVis(false);
        let curRemote = this.remoteFromId(gameId); //creates a new peer
        curRemote.createDataOffer()
    }

    // send data to server
    public wsSend(msg: wsMessageSend) {
        this.socket.send(JSON.stringify(msg))
    }

    /**
     * 
     * @param data peerInterface object to send
     * @param target id of who to send to, -1 for all, -2 for host
     */
    public rtcSendObj(data: peerInterface, target = -1) {
        // set target to -1 to send to all peers
        // set target to -2 to send to host (-1 wont work with host trying to send itself data)
        if(!this.id){
            return
        }
        if (this.hosting) {
            if (target === -2) { // host client trying to send to its host host
                this.onPeerMsg(data, this.id)
                return;
            }else if(target === this.id){ // host sending to its own client
                this.onHostClientMsg(data, this.id)
            }else if(target === -1){ // host sending to other client
                for (let p of this.peers) {
                    p.sendObj(data)
                }
            }else{
                this.remoteFromId(target).sendObj(data)
            }
        }else {
            // if your not the host you should only ever be sending to the host
            if(target !== -2){
                throw "Client should only be sending to host"
            }
            if(this.peers.length === 1){
                this.peers[0].sendObj(data)
            }
        }
    }



    public getGames(callback: (list: Array<gameInfo>) => void) {
        this.wsSend({type:"list-games"})
        this.onGameList = callback;
    }

    public setVis(set: boolean): void {
        // sets game visability
        this.visable = set;
        this.wsSend({type:"set-game-vis", data:this.visable})
    }

    public toggleVis(): boolean {
        this.setVis(!this.visable)
        return this.visable;
    }
    public setMode(mode: gameType){
        this.wsSend({type:"set-mode", data:mode})
    }
    public setName(name: string){
        this.wsSend({type:"set-name", data:name})
    }
    public setPlayers(p: number){
        this.wsSend({type:"set-players", data:p})
    }

    // if all peers are ready to send info
    public isReady() {
        return this.peers.every(x => x.ready)
    }
}

// one object shared between all modules using it
export const networking = new Networking()
