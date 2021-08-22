import { Player } from "./player.js"
import { Mouse } from "./mouse.js";
import { Keyboard } from "./keyboard.js"
import { Networking, peerInterface, stateMessage, playerData } from "./networking.js"
import { showText, Vector2, Rect, scaleNumber } from "./utils.js"

export type Map = Array<{ p1: Vector2, p2: Vector2 }>

// generate map
function generateMap(size = 20, density = 0.2): Map {
    let lines: Map = []
    for (let i = 0; i < (size ** 2) * density; i++) {
        let x1 = Math.floor(Math.random() * (size - 1)) + 1
        let y1 = Math.floor(Math.random() * (size - 1)) + 1
        let x2 = x1 + Math.floor(Math.random() * 3) - 1
        let y2 = y1 + Math.floor(Math.random() * 3) - 1
        lines.push({ p1: new Vector2(x1 / size, y1 / size), p2: new Vector2(x2 / size, y2 / size) })
    }
    return lines
}

// only runs on the host, handles phisics, hitreg, game events
// authorative on everything
class GameHost {
    tickrate = 20;
    map: Map = generateMap()
    players: Array<playerData> = [];
    constructor() {
        // override networkings callbacks
        networking.setOnPeerMsg((msg, id)=>{
            // console.log(`recived message ${JSON.stringify(msg)}`)
            if(msg.type === "game-state"){
                this.givePlayerState(id, msg.data[0].x, msg.data[0].y);
            }else{
                console.log("host got something unknown")
            }
        })
        networking.setOnNewPeer(id=>{
            console.log("sending new client the map")
            networking.rtcSendObj({ type: "world-data", data: game.map }, id); // give the new client the map
            setInterval(()=>{gameHost!.tick()}, 1000 / gameHost!.tickrate)
        })
        // console.log("sending initial clients the map")
        // networking.rtcSendObj({ type: "world-data", data: this.map })
        console.log("created game host")
    }

    tick() {
        for(let player of this.players){
            const info = this.generateGameState(player.id)
            if(player.id !== networking.id){
                networking.rtcSendObj({type:"game-state", data:info}, player.id)
            }else{
                // send to ourself
                Game.onPeerMsg({type:"game-state", data:info})
            }
        }
    }

    // decides what data to send to the given player
    generateGameState(id: number = -1): Array<playerData>{
        // id for only sending whats near to the player
        // -1 for sending everything
        if(id == -1){
            return this.players
        }else{
            return this.players.filter(x=>x.id !== id)
        }
    }

    // recives player info
    givePlayerState(id: number, x: number, y: number){
        let matches = this.players.filter(x=>x.id === id)
        if(matches.length >= 1){
            matches[0].x = x;
            matches[0].y = y;
        }else{
            console.log("tried to set player data on player that doesnt exist")
            this.players.push({id: id, x:x, y:y})
        }
    }
}


// Handles rendering, player input, movement prediction
// will run the same wether you are the host or client
export class Game {
    framerate: number = 0;
    canvas: HTMLCanvasElement;
    frametimes: Array<number> = [];
    players: Array<playerData> = [];
    // player: Player;
    map: Array<{ p1: Vector2, p2: Vector2 }> = [];
    viewPos: Rect = new Rect(0, 0, 999, 0.2);
    clientTickRate = 20;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.players = [];
    }

    public static onPeerMsg(message: peerInterface): void {
        // console.log(`get message`)
        // console.log(message)
        switch(message.type){
            case "world-data":
                for(let lineRaw of message.data){
                    let line = {p1:new Vector2(lineRaw.p1.x, lineRaw.p1.y), p2:new Vector2(lineRaw.p2.x, lineRaw.p2.y)};
                    if(!game.map.some(x=>{x==line})){ // if we dont already have it
                        game.map.push(line)
                    }
                }
                console.log("set map")
            break;
            case "game-state":
                game.players = message.data;
        }
    }

    render(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = "red";
        ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
        ctx.fill();

        this.viewPos.w = this.viewPos.h * this.canvas.width / this.canvas.height

        // draw map
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#000";
        // console.log(this.map)
        for (let line of this.map) {
            if (
                (line.p1.x > this.viewPos.x && line.p1.x < this.viewPos.x + this.viewPos.w &&
                    line.p1.y > this.viewPos.y && line.p1.y < this.viewPos.y + this.viewPos.h) ||
                (line.p2.x > this.viewPos.x && line.p2.x < this.viewPos.x + this.viewPos.w &&
                    line.p2.y > this.viewPos.y && line.p2.y < this.viewPos.y + this.viewPos.h)
            ) {
                ctx.beginPath();
                let start = line.p1.worldToPixel(this.viewPos, this.canvas)
                ctx.moveTo(start.x, start.y)
                let end = line.p2.worldToPixel(this.viewPos, this.canvas)
                ctx.lineTo(end.x, end.y)
                ctx.stroke();
            }
        }

        // draw minimap outline
        let minimapRect = { x: this.canvas.width - 211, y: this.canvas.height - 211, w: 200, h: 200 };
        // background
        ctx.beginPath();
        ctx.fillStyle = "rgba(200, 200, 200, 0.8)"
        ctx.rect(minimapRect.x, minimapRect.y, minimapRect.w, minimapRect.h);
        ctx.fill();

        // actual map
        ctx.lineWidth = 2;
        for (let line of this.map) {
            ctx.beginPath();
            ctx.moveTo(minimapRect.x + line.p1.x * minimapRect.w, minimapRect.y + line.p1.y * minimapRect.h)
            ctx.lineTo(minimapRect.x + line.p2.x * minimapRect.w, minimapRect.y + line.p2.y * minimapRect.h)
            ctx.stroke();
        }
        // our viewport
        ctx.beginPath();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
        ctx.fillStyle = "rgba(200, 200, 200, 0.8)"
        ctx.rect(
            minimapRect.x + this.viewPos.x * minimapRect.w,
            minimapRect.y + this.viewPos.y * minimapRect.h,
            minimapRect.w * this.viewPos.w,
            minimapRect.h * this.viewPos.h);
        ctx.fill();

        // other viewports
        for (let p of this.players) {
            ctx.beginPath();
            ctx.rect(
                minimapRect.x + p.x * minimapRect.w,
                minimapRect.y + p.y * minimapRect.h,
                minimapRect.w * this.viewPos.w,
                minimapRect.h * this.viewPos.h);
            ctx.fill();
        }

        // border
        ctx.beginPath();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.rect(minimapRect.x, minimapRect.y, minimapRect.w, minimapRect.h);
        ctx.stroke();

        showText(ctx, Math.round(this.framerate * 100) / 100 + "fps", 100, 50, 30);
    }

    update(dt: number) {
        // dt in ms
        // for (let i = 0; i < this.players.length; i++) {
        //     this.players[i].update(dt);
        // }
        if (keyboard.checkKey("KeyD")) {
            this.viewPos.x += dt / 10000;
        }
        if (keyboard.checkKey("KeyA")) {
            this.viewPos.x -= dt / 10000;
        }
        if (keyboard.checkKey("KeyW")) {
            this.viewPos.y -= dt / 10000;
        }
        if (keyboard.checkKey("KeyS")) {
            this.viewPos.y += dt / 10000;
        }

        this.frametimes.push(dt);
        if (this.frametimes.length > 10) {
            this.frametimes.shift(); // removes the oldest item
        }
        this.framerate = 1 / (this.frametimes.reduce((a, b) => a + b) / (1000 * this.frametimes.length));
    }
    joinRandomGame() {
        let possibleGames = networking.gamesList.filter(x => x != networking.id)
        networking.joinGame(possibleGames[0])
    }
    joinGame(id: number) {
        if (networking.gamesList.some(x => x == id)) {
            networking.joinGame(id);
            gamesListOuter!.style.transform = "translate(-50%, -200%)";
            setInterval(()=>{this.sendInfo()}, 1000/this.clientTickRate)
        } else {
            console.log("game dosent exist")
        }
    }

    // send the server info for this client
    sendInfo(){
        if(!this.isHosting()){
            if(networking.isReady()){ // tests if peer is ready
                networking.rtcSendObj({
                    type: "game-state",
                    data: [{x:this.viewPos.x, y:this.viewPos.y, id:networking.id}]
                  } as stateMessage)
            }else{
                console.log("isnt ready")
            }
        }else{
            console.log("is hosting")
        }
    }
    refreshGamesList() {
        networking.getGames((list) => createGameList(list, networking.id!))
    }
    generateLocalState(): void {
        
    }

    isHosting(){
        return networking.hosting
    }
}

// const physsRate: number = 100; // goal framerate for physics

const mouse = new Mouse();
const keyboard = new Keyboard();

const game = new Game(canvas);
const networking = new Networking()
networking.setOnPeerMsg(Game.onPeerMsg)
let gameHost: GameHost | undefined; // dont initialize

let gamesListOuter = document.getElementById("gameListOuter")
document.getElementById("refreshButton")!.onclick = () => { game.refreshGamesList() }
document.getElementById("testButton")!.onclick = () => { networking.rtcSendString("this is working YAY!"); console.log("send data") }
let gameButton = document.getElementById("gameButton");
if (gameButton) {
    gameButton.onclick = () => {
        let x = networking.toggleVis();
        gameButton!.innerHTML = x ? "toggle game visability [x]" : "toggle game visability [ ]";
    }
} else { console.log("game button didnt exist") }

function createGameList(list: Array<number>, ourId: number) {
    // first clear previouse list
    let prevItems = document.querySelectorAll(".gameListItem")
    console.log(prevItems)
    if (prevItems) {
        for (var idx = 0; idx < prevItems.length; idx++) {
            let item = prevItems[idx];
            item.remove();
        }
    }
    for (let id of list) {
        let trNode = document.createElement("tr");
        trNode.classList.add("gameListItem");

        let nameNode = document.createElement("td");
        if (id == ourId) {
            var nameText = document.createTextNode("exampleName (you)");
        } else {
            var nameText = document.createTextNode("exampleName");
        }
        nameNode.appendChild(nameText);

        let idNode = document.createElement("td");
        let idText = document.createTextNode(id.toString());
        idNode.appendChild(idText);

        let playersNode = document.createElement("td");
        let playersText = document.createTextNode("exampleName");
        playersNode.appendChild(playersText);

        trNode.appendChild(nameNode);
        trNode.appendChild(idNode);
        trNode.appendChild(playersNode);

        trNode.onclick = () => { game.joinGame(id) }

        document.getElementById("gameList")?.appendChild(trNode);
    }
}

// <tr class="gameListItem">
//     <td>Jill</td>
//     <td>Smith</td>
//     <td>50</td>
// </tr>


let lastTick: number = performance.now()
function tick(nowish: number) {
    let delta: number = nowish - lastTick;
    lastTick = nowish;

    if(game.isHosting()){
        if(!gameHost){
            gameHost = new GameHost();
            game.map = gameHost.map;
        }
        // gameHost.tick() // gameHost sets it own interval for tick
        gameHost.givePlayerState(networking.id!, game.viewPos.x, game.viewPos.y)

        game.update(delta);
        game.render(ctx);
    }else{
        // phisUpdates = Math.ceil(delta/physRate)
        game.update(delta);
        game.render(ctx);
    }
    
    window.requestAnimationFrame(tick);
}

window.requestAnimationFrame(tick)
