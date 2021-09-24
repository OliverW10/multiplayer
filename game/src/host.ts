import { UiMessage } from ".";
import { Game } from "./game";
import { networking, peerInterface, playerInputMessage, playerStateMessage, pong } from "./networking";
import { Player } from "./player";
import { Line, myRandom, round, Vector2 } from "./utils";
import { generateMap, World } from "./world";

enum gameState{
    playing,
    endGame,
}

// only runs on the host, handles phisics, hitreg, game events
// authorative on everything
export class GameHost {
    static netTickrate = 30;
    static physTickrate = 60;

    netTickrate = GameHost.netTickrate;
    physickrate = GameHost.physTickrate;

    tickNum = 0;
    tickTimes: Array<{num: number, time: number}> = [];
    mapSeed = round(myRandom(9999, 999999));
    map: World = generateMap(this.mapSeed)
    players: Array<Player> = [];
    createExplosion: (pos: Vector2, fromId: number)=>void;

    // game length fixed for now at 5 mins
    static GAME_LENGTH_S = 5*60
    static GAME_LENGTH_T = GameHost.GAME_LENGTH_S*GameHost.netTickrate; // ticks per game
    state = gameState.playing;

    uiCallback: (msgType: UiMessage, data?: any)=>void;

    netInterval: number;
    physInterval: number;
    lastPhysTick = performance.now()
    running = true;

    constructor(uiCallback: (mesType: UiMessage)=>void) {
        this.uiCallback = uiCallback;
        // override networkings callbacks
        networking.rtcSendObj({ type: "world-data", data: this.mapSeed }, -1); // give the new client the map
        networking.setOnNewPeer(id => {
            console.log("sending new client the map")
            networking.rtcSendObj({ type: "world-data", data: this.mapSeed }, id); // give the new client the map
        })

        this.netInterval = window.setInterval(() => { this.netTick() }, 1000 / this.netTickrate) // set tick interval to send to clients
        this.physInterval = window.setInterval(()=> { this.phyTick() }, 1000 / this.physickrate)
        // console.log("sending initial clients the map")
        // networking.rtcSendObj({ type: "world-data", data: this.map })
        console.log("created game host")

        this.createExplosion = ( (pos: Vector2, fromId: number)=>{
            console.log("called host create explosion")
            for(let p of this.players){
                if(p.id === fromId){
                    p.impulseFrom(pos, 0.04, 0.2, 50);
                }else{
                    p.impulseFrom(pos, 0.04, 0.1, 100);
                }
            }
        } ).bind(this);

        this.onPeerLeave = this.onPeerLeave.bind(this);
        this.onPeerMsg = this.onPeerMsg.bind(this)
    }

    stopHosting(){
        this.running = false;
        window.clearInterval(this.physInterval);
        window.clearInterval(this.netInterval);
    }

    onPeerMsg(msg: peerInterface, id: number) {
        // console.log(`recived message ${JSON.stringify(msg)}`)
        switch(msg.type){
            case("player-input"):
                if(msg.data.noMap){
                    networking.rtcSendObj({ type: "world-data", data:this.mapSeed })
                }
                this.takePlayerInput(id, msg);
                break;
            case("pong"):
                this.takePing(id, msg);
                break;
            default:
                console.log("host got something unknown")
        }
    }

    netTick() {
        // console.log("net tick")
        // console.log(this.players)
        this.tickNum += 1;
        if(this.tickNum > GameHost.GAME_LENGTH_T){
            this.reset();
        }
        if(this.tickTimes.push({num: this.tickNum, time: performance.now()}) >= 30){ // push returns length
            this.tickTimes.shift()
        }
        // console.log("host network tick")
        // network tick
        for (let player of this.players) {
            const info = this.generateGameState(player.id)
            // rtcsendobj will route message to game if its for ourself
            networking.rtcSendObj(info, player.id)
        }
    }

    phyTick(dt?: number) {
        // phsics tick happens independantly of the network tick
        // if no dt is given it will work its own one out
        if(!dt){
            let now = performance.now();

            const dt = Math.min(1000, now-this.lastPhysTick); // caps dt at 1 second
            for (let player of this.players) {
                player.update(dt, this.map, true)
            }

            this.lastPhysTick = now;

        }else{
            for (let player of this.players) {
                player.update(dt, this.map, true)
            }
        }
        
    }

    // decides what data to send to the given player
    generateGameState(id: number = -1): playerStateMessage {
        // id for only sending whats near to the player
        // -1 for sending everything
        if (id == -1) {
            return {
                type: "game-state",
                data: this.players.map(x => x.toData()),
                frame: this.tickNum,
            }
        } else {
            return {
                type: "game-state",
                // TODO: impliment filter on who to send to who
                data: this.players.filter(x => true).map(x => x.toData()),
                frame: this.tickNum,
            }
        }
    }

    takePing(id: number, msg: pong){
        const timeMatches = this.tickTimes.filter(x=>x.num == msg.frame) // find the time the frame was send out
        if(timeMatches.length >= 1){
            var frameActualTime = timeMatches[0].time;
        }else{
            var frameActualTime = 0; // frame has been sent
        }
        const returnFrameTime = performance.now()
        let matches = this.players.filter(x => x.id === id)
        if (matches.length == 1) {
            matches[0].ping = returnFrameTime-frameActualTime;
        }
    }

    // recives player info
    takePlayerInput(id: number, msg: playerInputMessage) {
        let matches = this.players.filter(x => x.id === id)
        if (matches.length == 1) {
            matches[0].takeInput(msg, this.map)
        } else if (matches.length > 1) {
            console.log(`there were ${matches.length} players with the same id (too many)`)
        } else {
            console.log("tried to set player data on player that doesnt exist, creating player")
            this.players.push(Player.newRandom(id, this.createExplosion))
        }
    }

    onPeerLeave(id: number){
        console.log(`removing player ${id}`)
        this.players.filter(pl=>pl.id !== id); // remove leaving player from list
    }

    reset(){
        this.tickNum = 0;
        this.mapSeed = myRandom(9999, 999999);
        for(let p of this.players){
            p.reset();
            networking.rtcSendObj({ type: "world-data", data: this.mapSeed }, p.id); // give the new client the map
        }
    }
}