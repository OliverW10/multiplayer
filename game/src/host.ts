import { Game, gamesListOuter } from "./game.js";
import { networking, playerInputMessage, playerStateMessage } from "./networking.js";
import { Player } from "./player.js";
import { Line, round, Vector2 } from "./utils.js";

export type World = Array<Line>

// checks if two lines have a shared point
function checkShared(l1: Line, l2: Line): boolean{
    return (
        l1.p1.equals(l2.p1) ||
        l1.p2.equals(l2.p2) ||
        l1.p1.equals(l2.p2)
    )
}

// checks if two lines are parralel
function checkParr(l1: Line, l2: Line): boolean{
    const ang1 = round(l1.p1.angleTo(l1.p2), 3);
    const ang1Inv = round(l1.p2.angleTo(l1.p1), 3);
    const ang2 = round(l2.p1.angleTo(l2.p2), 3);
    return ang2 == ang1 || ang2 == ang1Inv;

}
const MAX_LINE_LENGTH = 5;
// generate map
function generateMap(size = 20, density = 0.2): World {
    let lines: World = []

    // create random lines
    for (let i = 0; i < (size ** 2) * density; i++) {
        let x1 = Math.floor(Math.random() * (size - 1)) + 1
        let y1 = Math.floor(Math.random() * (size - 1)) + 1
        let x2 = x1 + Math.floor(Math.random() * 3) - 1
        let y2 = y1 + Math.floor(Math.random() * 3) - 1
        // to stop starting and ending on the same spot
        while(x1==x2 && y1==y2){
            x2 = x1 + Math.floor(Math.random() * 3) - 1
            y2 = y1 + Math.floor(Math.random() * 3) - 1    
        }
        lines.push({ p1: new Vector2(x1 / size, y1 / size), p2: new Vector2(x2 / size, y2 / size)})
    }

    // let newLines: Map = []
    // // check for long straight lines and combined
    // for(let line of lines){
    //     // for each line check for other lines with shared points
    //     const shareds = lines.filter(x=>checkShared(line, x))
    //     if(shareds.length === 0){
    //         newLines.push(line);
    //     }else{
    //         for(let shared in shareds){
    //             if(checkParr)
    //         }
    //     }
    // }
    return lines
}

// only runs on the host, handles phisics, hitreg, game events
// authorative on everything
export class GameHost {
    tickrate = 30;
    map: World = generateMap()
    players: Array<Player> = [];
    constructor() {
        gamesListOuter!.style.transform = "translate(-50%, -200%)";
        // override networkings callbacks
        networking.setOnPeerMsg((msg, id) => {
            // console.log(`recived message ${JSON.stringify(msg)}`)
            switch(msg.type){
                case("player-input"):
                    this.givePlayerInput(id, msg);
                    break;
                default:
                    console.log("host got something unknown")
            }
        })
        networking.setOnNewPeer(id => {
            console.log("sending new client the map")
            networking.rtcSendObj({ type: "world-data", data: this.map }, id); // give the new client the map
        })

        setInterval(() => { this.tick() }, 1000 / this.tickrate) // set tick interval to send to clients
        // console.log("sending initial clients the map")
        // networking.rtcSendObj({ type: "world-data", data: this.map })
        console.log("created game host")
    }

    tick() {
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
            player.update(dt, this.map)
        }
    }

    // decides what data to send to the given player
    generateGameState(id: number = -1): playerStateMessage {
        // id for only sending whats near to the player
        // -1 for sending everything
        if (id == -1) {
            return {
                type: "game-state",
                data: this.players.map(x => x.toData())
            }
        } else {
            return {
                type: "game-state",
                // TODO: impliment filter on who to send to who
                data: this.players.filter(x => true).map(x => x.toData())
            }
        }
    }

    // recives player info
    givePlayerInput(id: number, msg: playerInputMessage) {
        let matches = this.players.filter(x => x.id === id)
        if (matches.length == 1) {
            matches[0].inputX = msg.data.inputX;
            matches[0].inputY = msg.data.inputY;
            if(msg.data.swinging && !matches[0].swinging){ // only set swingPos on first one
                console.log("set swinging")
                const closest = this.findClosestHandle(matches[0])
                matches[0].swingPos = closest.pos;
                matches[0].swingDist = closest.dist;
            }
            matches[0].swinging = msg.data.swinging;
        } else if (matches.length > 1) {
            console.log(`there were ${matches.length} players with the same id (too many)`)
        } else if (matches.length < 0) {
            console.log("what the fuck")
        } else {
            console.log("tried to set player data on player that doesnt exist, creating player")
            this.players.push(Player.newRandom(id))
        }
    }

    findClosestHandle(player: Player): {pos:Vector2, dist:number}{
        let minDist = 9999;
        let minPos = new Vector2(0, 0)
        for(let line of this.map){
            const dist1 = (line.p1.x-player.pos.x)**2 + (line.p1.y-player.pos.y)**2;
            if(dist1 < minDist){
                if(!player.recentlySwung.some((x)=>x.p.equals(line.p1))){
                    minDist = dist1;
                    minPos = line.p1;
                }
            }
            const dist2 = (line.p2.x-player.pos.x)**2 + (line.p2.y-player.pos.y)**2;
            if(dist2 < minDist){
                if(!player.recentlySwung.some((x)=>x.p.equals(line.p2))){
                    minDist = dist2;
                    minPos = line.p2;
                }
            }
        }
        return {pos:minPos, dist:Math.sqrt(minDist)};
    }
}