import { Game, gamesListOuter } from "./game.js";
import { networking } from "./networking.js";
import { Player } from "./player.js";
import { generateMap } from "./world.js";
// only runs on the host, handles phisics, hitreg, game events
// authorative on everything
export class GameHost {
    constructor() {
        this.tickrate = 30;
        this.tickNum = 0;
        this.tickTimes = [];
        this.map = generateMap();
        this.players = [];
        gamesListOuter.style.transform = "translate(-50%, -200%)";
        // override networkings callbacks
        networking.setOnPeerMsg((msg, id) => {
            // console.log(`recived message ${JSON.stringify(msg)}`)
            switch (msg.type) {
                case ("player-input"):
                    this.takePlayerInput(id, msg);
                    break;
                case ("pong"):
                    this.takePing(id, msg);
                    break;
                default:
                    console.log("host got something unknown");
            }
        });
        networking.setOnNewPeer(id => {
            console.log("sending new client the map");
            networking.rtcSendObj({ type: "world-data", data: this.map }, id); // give the new client the map
        });
        setInterval(() => { this.tick(); }, 1000 / this.tickrate); // set tick interval to send to clients
        // console.log("sending initial clients the map")
        // networking.rtcSendObj({ type: "world-data", data: this.map })
        console.log("created game host");
        this.createExplosion = (pos) => {
            console.log("called host create explosion");
            for (let p of this.players) {
                p.impulseFrom(pos, 0.05);
            }
        };
    }
    tick() {
        this.tickNum += 1;
        if (this.tickTimes.push({ num: this.tickNum, time: performance.now() }) >= 30) { // push returns length
            this.tickTimes.shift();
        }
        // console.log("host network tick")
        // network tick
        for (let player of this.players) {
            const info = this.generateGameState(player.id);
            if (player.id !== networking.id) {
                networking.rtcSendObj(info, player.id);
            }
            else {
                // send to ourself
                Game.onPeerMsg(info);
            }
        }
    }
    phyTick(dt) {
        // phsics update happens more often than network tick
        // is called from main animation loop
        for (let player of this.players) {
            player.update(dt, this.map);
        }
    }
    // decides what data to send to the given player
    generateGameState(id = -1) {
        // id for only sending whats near to the player
        // -1 for sending everything
        if (id == -1) {
            return {
                type: "game-state",
                data: this.players.map(x => x.toData()),
                frame: this.tickNum,
            };
        }
        else {
            return {
                type: "game-state",
                // TODO: impliment filter on who to send to who
                data: this.players.filter(x => true).map(x => x.toData()),
                frame: this.tickNum,
            };
        }
    }
    takePing(id, msg) {
        const timeMatches = this.tickTimes.filter(x => x.num == msg.frame); // find the time the frame was send out
        if (timeMatches.length >= 1) {
            var frameActualTime = timeMatches[0].time;
        }
        else {
            var frameActualTime = 0; // frame has been sent
        }
        const returnFrameTime = performance.now();
        let matches = this.players.filter(x => x.id === id);
        if (matches.length == 1) {
            matches[0].ping = returnFrameTime - frameActualTime;
        }
    }
    // recives player info
    takePlayerInput(id, msg) {
        let matches = this.players.filter(x => x.id === id);
        if (matches.length == 1) {
            matches[0].takeInput(msg, this.map);
        }
        else if (matches.length > 1) {
            console.log(`there were ${matches.length} players with the same id (too many)`);
        }
        else {
            console.log("tried to set player data on player that doesnt exist, creating player");
            this.players.push(Player.newRandom(id, this.createExplosion));
        }
    }
}
