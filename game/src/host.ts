import { Game, gamesListOuter } from "./game";
import { networking, playerInputMessage, playerStateMessage, pong } from "./networking";
import { Player } from "./player";
import { Line, round, Vector2 } from "./utils";
import { generateMap, World } from "./world";


// only runs on the host, handles phisics, hitreg, game events
// authorative on everything
export class GameHost {
    tickrate = 30;
    tickNum = 0;
    tickTimes: Array<{num: number, time: number}> = [];
    mapSeed = 379491230;
    map: World = generateMap(this.mapSeed)
    players: Array<Player> = [];
    createExplosion: (pos: Vector2, fromId: number)=>void;

    constructor() {
        gamesListOuter!.style.transform = "translate(-50%, -200%)";
        // override networkings callbacks
        networking.setOnPeerMsg((msg, id) => {
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
        })
        networking.setOnNewPeer(id => {
            console.log("sending new client the map")
            networking.rtcSendObj({ type: "world-data", data: this.mapSeed }, id); // give the new client the map
        })

        setInterval(() => { this.netTick() }, 1000 / this.tickrate) // set tick interval to send to clients
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
    }

    netTick() {
        this.tickNum += 1;
        if(this.tickTimes.push({num: this.tickNum, time: performance.now()}) >= 30){ // push returns length
            this.tickTimes.shift()
        }
        // console.log("host network tick")
        // network tick
        for (let player of this.players) {
            const info = this.generateGameState(player.id)
            if (player.id !== networking.id) {
                networking.rtcSendObj(info, player.id)
            } else {
                // send to ourself
                Game.onPeerMsg(info)
            }
        }
    }

    phyTick(dt: number) {
        // phsics update happens more often than network tick
        // is called from main animation loop

        for (let player of this.players) {
            player.update(dt, this.map, true)
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
}