import { Player } from "./player"
import { mouse } from "./mouse";
import { keyboard } from "./keyboard"
import { networking, peerInterface, playerInputMessage } from "./networking"
import { showText, Vector2, Rect, round, getLineRect } from "./utils"
import { GameHost } from "./host";
import { Explosion } from "./particle";
import { generateMap } from "./world";
import { ctx, canvas } from "./index";


// Handles rendering, player input, movement prediction
// will run the same wether you are the host or client
export class Game {
    framerate: number = 0;
    frametimes: Array<number> = [];
    players: Array<Player> = [];
    map: Array<{ p1: Vector2, p2: Vector2 }> = [];
    viewPos: Rect = new Rect(0, 0, 999, 0.2);
    VIEW_MARGIN = 0.1; // draw things up to 0.2 outside view to prevent popin 
    outerViewPos: Rect = new Rect(0, 0, 999, 0.3);
    clientTickRate = 30;
    lastTickTime: number = 0; // time since last tick
    inputX = 0; // rotation input + is clockwise
    inputY = 0; // forwards input + is forwards
    lookAngle = 0;
    closesHandle: Vector2 = new Vector2(-1, -1);
    closesntHandleDist = 99999;
    grabbing = false;
    shooting = false;
    detonating = false;
    us: Player | void | undefined;
    explosions: Array<Explosion> = [];
    createExplosion: (pos: Vector2)=>void;

    constructor() {
        this.players = [];

        this.createExplosion = (pos: Vector2)=>{
            console.log("called create explosion")
            for(let p of game.players){
                p.impulseFrom(pos, 0.04)
            }
            game.explosions.push(new Explosion(pos, 0.04))
        }
    }

    public static onPeerMsg(message: peerInterface): void {
        // console.log(`get message`)
        // console.log(message)
        switch (message.type) {
            case "world-data":
                const mapData = generateMap(message.data)
                for (let lineRaw of mapData) {
                    let line = { p1: new Vector2(lineRaw.p1.x, lineRaw.p1.y), p2: new Vector2(lineRaw.p2.x, lineRaw.p2.y) };
                    if (!game.map.some(x => { x == line })) { // if we dont already have it
                        game.map.push(line)
                    }
                }
                console.log("set map")
                break;
            case "game-state":
                // console.log("got game state")
                // console.log(JSON.stringify(message))
                let curIds = game.players.map(x => x.id)
                for (let player of message.data) {
                    if (curIds.indexOf(player.id) != -1) {
                        const idx = curIds.indexOf(player.id)
                        game.players[idx].networkUpdate(player)
                    } else {
                        console.log(`created new player ${player.id}`) 
                        game.players.push(Player.fromPlayerData(player, game.createExplosion))
                        curIds = game.players.map(x => x.id)
                    }
                }
                networking.rtcSendObj({type:"pong", frame: message.frame});
        }
    }

    render(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "red";
        ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
        ctx.fill();

        this.viewPos.w = this.viewPos.h * canvas.width / canvas.height

        // TODO: maybe dont need to call every frame
        this.outerViewPos = new Rect(
            this.viewPos.x-this.VIEW_MARGIN/2,
            this.viewPos.y-this.VIEW_MARGIN/2,
            this.viewPos.w+this.VIEW_MARGIN,
            this.viewPos.h+this.VIEW_MARGIN
        );
        // same here
        this.us = this.getOurPlayer();

        if(this.players.length >= 1){
            this.drawMap();
            this.drawMinimap();
            this.drawPlayers();
        }
        

        showText(ctx, Math.round(this.framerate * 100) / 100 + "fps", 100, 50, 30);
    }

    drawMinimap(){
        // draw minimap
        let minimapRect = { x: canvas.width - 211, y: canvas.height - 211, w: 200, h: 200 };
        // background
        ctx.beginPath();
        ctx.fillStyle = "rgba(200, 200, 200, 0.8)"
        ctx.rect(minimapRect.x, minimapRect.y, minimapRect.w, minimapRect.h);
        ctx.fill();

        // actual minimap
        ctx.strokeStyle = "rgb(0, 0, 0, 0.9)";
        ctx.lineWidth = 2;
        for (let line of this.map) {
            ctx.beginPath();
            ctx.moveTo(minimapRect.x + line.p1.x * minimapRect.w, minimapRect.y + line.p1.y * minimapRect.h)
            ctx.lineTo(minimapRect.x + line.p2.x * minimapRect.w, minimapRect.y + line.p2.y * minimapRect.h)
            ctx.stroke();
        }
        // our viewport
        ctx.beginPath();
        ctx.fillStyle = "rgba(200, 200, 200, 0.8)"
        ctx.rect(
            minimapRect.x + this.viewPos.x * minimapRect.w,
            minimapRect.y + this.viewPos.y * minimapRect.h,
            minimapRect.w * this.viewPos.w,
            minimapRect.h * this.viewPos.h);
        ctx.fill();

        for(let p of this.players){
            // render them on minimap
            ctx.beginPath();
            ctx.fillStyle = "rgba(255, 0, 0, 1)"
            ctx.rect(
                minimapRect.x + p.pos.x * minimapRect.w,
                minimapRect.y + p.pos.y * minimapRect.h,
                10,
                10);
            ctx.fill();
        }

        // border
        ctx.beginPath();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.rect(minimapRect.x, minimapRect.y, minimapRect.w, minimapRect.h);
        ctx.stroke();
        ctx.beginPath();
    }

    drawMap(){
        // draw map
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#000";
        // console.log(this.map)
        this.closesHandle = new Vector2(-1, -1);
        this.closesntHandleDist = 999;
        for (let line of this.map) {
            if (
                (line.p1.x > this.outerViewPos.x && line.p1.x < this.outerViewPos.x + this.outerViewPos.w &&
                    line.p1.y > this.outerViewPos.y && line.p1.y < this.outerViewPos.y + this.outerViewPos.h) ||
                (line.p2.x > this.outerViewPos.x && line.p2.x < this.outerViewPos.x + this.outerViewPos.w &&
                    line.p2.y > this.outerViewPos.y && line.p2.y < this.outerViewPos.y + this.outerViewPos.h)
            ) { // only run for lines within view + viewMargin
                const colBox = getLineRect(line);
                ctx.beginPath();
                if(this.us){
                    if(colBox.checkPos(this.us.pos)){
                        ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
                    }else{
                        ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
                    }
                }
                const rectPix = colBox.worldToPixel(this.viewPos, canvas);
                ctx.rect(rectPix.x, rectPix.y, rectPix.w, rectPix.h);
                ctx.fill();
                ctx.beginPath();
                let start = line.p1.worldToPixel(this.viewPos, canvas)
                ctx.moveTo(start.x, start.y)
                let end = line.p2.worldToPixel(this.viewPos, canvas)
                ctx.lineTo(end.x, end.y)
                ctx.stroke();

                if(this.us && !this.us.swinging){
                    // finding closest handle
                    const dist1 = this.playerDist(line.p1, true)
                    if( dist1 < this.closesntHandleDist && !this.us.recentlySwung.some((x)=>x.p.equals(line.p1))){
                        this.closesHandle = line.p1;
                        this.closesntHandleDist = dist1;
                    }
                    const dist2 = this.playerDist(line.p2, true)
                    if( dist2 < this.closesntHandleDist && !this.us.recentlySwung.some((x)=>x.p.equals(line.p2))){
                        this.closesHandle = line.p2;
                        this.closesntHandleDist = dist2;
                    }
                }
            }
        }

        for(let explo of this.explosions){
            explo.render(this.viewPos)
        }

        if(this.us && this.closesntHandleDist < 998){
            // draw handle effect
            ctx.beginPath();
            ctx.strokeStyle = "rgba(150, 150, 150, 0.8)";
            ctx.lineWidth = 5;
            const us = this.getOurPlayer();
            if(us){
                let start = us.pos.worldToPixel(this.viewPos, canvas)
                ctx.moveTo(start.x, start.y);
                let end = this.closesHandle.worldToPixel(this.viewPos, canvas)
                ctx.lineTo(end.x, end.y);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(end.x, end.y, 30, 0, Math.PI*2)
                ctx.stroke();
            }
        }
    }

    drawPlayers(){
        // our player should be included in players list
        // other players
        for (let p of this.players) {
            p.render(this.viewPos) // render them
        }
    }

    // finds the distance from any world position to our player
    playerDist(pos: Vector2, fast=false): number{
        // fast dosent do the sqrt because if all you care about is relative distance you dont need it
        if(this.us){
            const ourPos = this.us.pos;
            if(fast){
                return (ourPos.x-pos.x)**2 + (ourPos.y-pos.y)**2
            }else{
                return Math.sqrt( (ourPos.x-pos.x)**2 + (ourPos.y-pos.y)**2 )
            }
        }
        return 999;
    }

    getOurPlayer(): Player | void{
        const matches = this.players.filter(x=>x.id===networking.id)
        if(matches.length < 1){
            return;
        }else if(matches.length > 1){
            return;
        }
        return matches[0];
    }

    update(dt: number) {
        // dt in ms
        const dts = dt/1000; // delta time seconds

        for (let i = 0; i < this.players.length; i++) {
            this.players[i].update(dt, this.map);
        }


        if (keyboard.checkKey("KeyD")) {
            this.inputX += dt;
        }
        if (keyboard.checkKey("KeyA")) {
            this.inputX -= dt;
        }
        if (keyboard.checkKey("KeyW")) {
            this.inputY += dt;
        }
        if (keyboard.checkKey("KeyS")) {
            this.inputY -= dt;
        }
        if(keyboard.checkKey("Space")){
            this.grabbing = true;
        }else{
            this.grabbing = false;
        }
        if(mouse.hasClicked("left")){
            this.shooting = true;
        }
        this.detonating = mouse.right;

        this.lastTickTime += dt;

        const us = this.getOurPlayer();
        if(us){
            const viewTarget = new Vector2(us.pos.x, us.pos.y)
            // this.viewPos.setMid(this.viewPos.middle().interpolate(viewTarget, dts*5))
            this.viewPos.setMid(viewTarget)
            const outDrawPos = us.pos.worldToPixel(this.viewPos, canvas);
            this.lookAngle = outDrawPos.angleTo( new Vector2(mouse.x, mouse.y));
            us.setLookAngle(this.lookAngle)
            us.takeInput(this.getInput(false), this.map) // only for local
        }

        for(let explo of this.explosions){
            explo.update(dts);
        }
        this.explosions = this.explosions.filter(x=>x.alive)

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

            setInterval(() => { this.sendInput() }, 1000/this.clientTickRate);
            game.sendInput(); // send input back after the tick
        } else {
            console.log("game dosent exist")
        }
    }

    // send the server info for this client
    // called this.tickrate times per second
    // also used on host beacuse -2 routes host traffic directly
    sendInput() {
        if (networking.isReady()) { // tests if peer is ready
            networking.rtcSendObj(this.getInput(), -2);
        } else {
            console.log("isnt ready")
            console.log(networking.peers, networking.peers.map(x=>x.dataChannel.readyState))
        }
    }

    // seperate function so it can be used on host
    // send frame of -1 to not perform lag calculations
    getInput(forSend=true): playerInputMessage {
        const obj = {
            type: "player-input",
            data: {
                // set input to zero if there hasnt been any frames
                // when alt tabbed intervals (this) still run but requestAnimationFrame dosent, so no frames happen
                inputX: this.lastTickTime > 0 ? round(this.inputX / this.lastTickTime, 2) : 0,
                inputY: this.lastTickTime > 0 ? round(this.inputY / this.lastTickTime, 2) : 0,
                lookAngle: this.lookAngle,
            },
        } as playerInputMessage;

        if(this.grabbing){ obj.data["swinging"] = true }
        if(this.shooting){  obj.data["shooting"] = true }
        if(this.detonating){ obj.data["detonating"] = true }

        if(forSend){
            this.inputX = 0;
            this.inputY = 0;

            this.shooting = false;

            this.lastTickTime = 0; // time since last getInput (dt added in update)
        }
        return obj
    }
    refreshGamesList() {
        networking.getGames((list) => createGameList(list, networking.id!))
    }

    isHosting() {
        return networking.hosting
    }
}

// const physsRate: number = 100; // goal framerate for physics

const game = new Game();
networking.setOnPeerMsg(Game.onPeerMsg)
let gameHost: GameHost | undefined; // dont initialize

export let gamesListOuter = document.getElementById("gameListOuter")
document.getElementById("refreshButton")!.onclick = () => { game.refreshGamesList() }
document.getElementById("testButton")!.onclick = () => { networking.rtcSendString("this is working YAY!"); console.log("send data") }
let gameButton = document.getElementById("gameButton");
if (gameButton) {
    gameButton.onclick = () => {
        let x = networking.toggleVis();
        gameButton!.innerHTML = x ? "toggle game visability [x]" : "toggle game visability [ ]";
    }
} else { console.log("game button didnt exist") }

const wsConneectingMsg = document.getElementById("connectingMsg");
networking.onServerOpen = ()=>{
    wsConneectingMsg!.style.display = "none";
}

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
function tick(nowish: number) { // local updates only
    let delta: number = nowish - lastTick;
    lastTick = nowish;

    if (game.isHosting()) {
        if (!gameHost) {
            gameHost = new GameHost();
            game.map = gameHost.map;
            // gameHost.takePlayerInput(networking.id!, game.getInput()) // send input at start
            setInterval(() => { game.sendInput() }, 1000/game.clientTickRate);
        }
        // gameHost.tick() // gameHost sets it own interval for tick

        gameHost.phyTick(delta);

        game.update(delta);
        game.render(ctx);
    } else {
        // phisUpdates = Math.ceil(delta/physRate)
        if(networking.isReady() && game.players.length >= 1){
            game.update(delta);
            game.render(ctx);
        }
    }

    window.requestAnimationFrame(tick);
}

window.requestAnimationFrame(tick)
