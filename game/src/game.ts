import { Player } from "./player"
import { mouse } from "./mouse";
import { keyboard } from "./keyboard"
import { networking, peerInterface, playerInputMessage } from "./networking"
import { showText, Vector2, Rect, round, getLineRect, scaleNumber } from "./utils"
import { GameHost } from "./host";
import { Explosion } from "./particle";
import { generateMap } from "./world";
import { ctx, canvas } from "./index";


// Handles rendering, player input, movement prediction
// will run the same wether you are the host or client
export class Game {
    framerate: number = 0;
    frametimes: Array<number> = [];
    clientTickRate = 30;
    lastTickTime: number = 0; // time since last tick
    timeout = 0; // time since last network message
    age = 0;

    players: Array<Player> = []; // list of players, contains us
    explosions: Array<Explosion> = [];
    map: Array<{ p1: Vector2, p2: Vector2 }> = [];
    us: Player | void | undefined;

    viewPos: Rect = new Rect(0, 0, 999, 0.25);
    VIEW_MARGIN = 0.1; // draw things up to 0.2 outside view to prevent popin 
    outerViewPos: Rect = new Rect(0, 0, 999, 0.3);
    VIEWPORT_LEAD = 0.7;

    inputX = 0; // rotation input + is clockwise
    inputY = 0; // forwards input + is forwards
    lookAngle = 0;
    swingPos: Vector2 | undefined; // undefined if not swinging
    shooting = false;
    detonating = false;

    createExplosion: (pos: Vector2, fromId: number)=>void;

    constructor() {
        this.players = [];

        this.createExplosion = (pos: Vector2, fromId: number)=>{
            console.log("called create explosion")
            for(let p of game.players){
                if(p.id === fromId){
                    p.impulseFrom(pos, 0.04, 0.2, 50);
                }else{
                    p.impulseFrom(pos, 0.04, 0.1, 100);
                }
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
                game.timeout = 0;
        }
    }

    render(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "red";
        ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
        ctx.fill();

        this.viewPos.w = this.viewPos.h * canvas.width / canvas.height

        this.outerViewPos = new Rect(
            this.viewPos.x-this.VIEW_MARGIN/2,
            this.viewPos.y-this.VIEW_MARGIN/2,
            this.viewPos.w+this.VIEW_MARGIN,
            this.viewPos.h+this.VIEW_MARGIN
        );
        // probrobly dont need to call every frame
        this.us = this.getOurPlayer();

        if(this.players.length >= 1){
            this.drawMap();
            this.drawMinimap();
            this.drawPlayers();
        }
        
        if(this.us){
            showText(ctx, Math.round(this.us.speed * 1000) / 1000 + "/s", canvas.width/2, canvas.height-50, 30);
        }
        if(this.timeout > 2){
            showText(ctx, `timed out for: ${round(this.timeout, 1)}s`, canvas.width/2, canvas.height/2, 50, "rgb(200, 20, 20)");
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

        if(this.us){
            for(let p of this.players){
                // render them on minimap
                const dist = Math.sqrt( (p.pos.x-this.us.pos.x)**2 + (p.pos.y-this.us.pos.y)**2 )
                if(dist < this.viewPos.w){
                    var alpha = 1;
                }else{
                    var alpha = scaleNumber(dist, this.viewPos.w, 0.4, 1, 0, true)
                }
                ctx.beginPath();
                ctx.fillStyle = `rgba(50, 50, 50, ${alpha})`
                ctx.rect(
                    minimapRect.x + p.pos.x * minimapRect.w - 3,
                    minimapRect.y + p.pos.y * minimapRect.h - 3,
                    6,
                    6);
                ctx.fill();
            }
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
        let closesHandle = new Vector2(-1, -1); // to display indicator
        let closesntHandleDist = 999;
        for (let line of this.map) {
            
            if ( // checks if the line is visable (or near)
                ( // p1 inside
                    line.p1.x > this.outerViewPos.x &&
                    line.p1.x < this.outerViewPos.x + this.outerViewPos.w &&
                    line.p1.y > this.outerViewPos.y &&
                    line.p1.y < this.outerViewPos.y + this.outerViewPos.h
                ) || ( // p2 inside
                    line.p2.x > this.outerViewPos.x &&
                    line.p2.x < this.outerViewPos.x + this.outerViewPos.w &&
                    line.p2.y > this.outerViewPos.y &&
                    line.p2.y < this.outerViewPos.y + this.outerViewPos.h
                ) || ( // wider
                    Math.abs(line.p1.x-line.p2.x) > this.outerViewPos.w
                ) || ( // taller
                    Math.abs(line.p1.y-line.p2.y) > this.outerViewPos.y
                )
            ) { // only run for visable lines
                const colBox = getLineRect(line);

                // debug hitboxes
                // ctx.beginPath();
                // if(this.us){
                //     if(colBox.checkPos(this.us.pos)){
                //         ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
                //     }else{
                //         ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
                //     }
                // }
                // const rectPix = colBox.worldToPixel(this.viewPos, canvas);
                // ctx.rect(rectPix.x, rectPix.y, rectPix.w, rectPix.h);
                // ctx.fill();

                // actual line
                ctx.beginPath();
                let start = line.p1.worldToPixel(this.viewPos, canvas)
                ctx.moveTo(start.x, start.y)
                let end = line.p2.worldToPixel(this.viewPos, canvas)
                ctx.lineTo(end.x, end.y)
                ctx.stroke();

                if(this.us && !this.us.swinging){
                    // finding closest handle
                    const dist1 = this.playerDist(line.p1, true)
                    if( dist1 < closesntHandleDist && !this.us.recentlySwung.some((x)=>x.p.equals(line.p1))){
                        closesHandle = line.p1;
                        closesntHandleDist = dist1;
                    }
                    const dist2 = this.playerDist(line.p2, true)
                    if( dist2 < closesntHandleDist && !this.us.recentlySwung.some((x)=>x.p.equals(line.p2))){
                        closesHandle = line.p2;
                        closesntHandleDist = dist2;
                    }
                }
            }
        }

        for(let explo of this.explosions){
            explo.render(this.viewPos)
        }

        // line showing potential handle
        if(this.us && closesntHandleDist < 998){
            // draw handle effect
            ctx.beginPath();
            ctx.strokeStyle = "rgba(150, 150, 150, 0.8)";
            ctx.lineWidth = 5;
            const us = this.getOurPlayer();
            if(us){
                let start = us.pos.worldToPixel(this.viewPos, canvas)
                ctx.moveTo(start.x, start.y);
                let end = closesHandle.worldToPixel(this.viewPos, canvas)
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
        this.age += dts;

        for (let i = 0; i < this.players.length; i++) {
            this.players[i].update(dt, this.map);
        }
        const us = this.getOurPlayer();

        if(us){

            //// getting input ////
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
                if(!this.swingPos){
                    this.swingPos = us.findClosestHandle(this.map).pos;
                }
            }else{
                this.swingPos = undefined;
            }
            if(mouse.hasClicked("left")){
                this.shooting = true;
            }
            this.detonating = mouse.right;

            const viewTarget = new Vector2(
                us.pos.x + us.speed*Math.cos(us.angle)*this.VIEWPORT_LEAD,
                us.pos.y + us.speed*Math.sin(us.angle)*this.VIEWPORT_LEAD,
            )
            this.viewPos.h = scaleNumber(us.speed, 0, 0.1, 0.25, 0.35, true);
            this.viewPos.setMid(this.viewPos.middle().interpolate(viewTarget, dts*5))
            // this.viewPos.setMid(viewTarget)
            const outDrawPos = us.pos.worldToPixel(this.viewPos, canvas);
            this.lookAngle = outDrawPos.angleTo( new Vector2(mouse.x, mouse.y));

            // client side prediction
            us.setLookAngle(this.lookAngle)
            us.takeInput(this.getInput(false), this.map, true) // only for local

            if(this.shooting && us.netBulletAlive){
                // means the shot has been comfired
                // may cause issues when you try to shoot just after your last bullet dissapears
                this.shooting = false;
            }
        }


        this.lastTickTime += dt;

        for(let explo of this.explosions){
            explo.update(dts);
        }
        this.explosions = this.explosions.filter(x=>x.alive)

        this.timeout += dts;

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
        if (networking.gamesList.some(x => x == id)) { // if we know the game exists
            if(networking.id && id !== networking.id){
                networking.joinGame(id);
                gamesListOuter!.style.transform = "translate(-50%, -200%)";

                this.sendInput = this.sendInput.bind(this);
                networking.setOnNewPeer(()=>{ // when the connection has been created start sending packets
                    console.log("set sendinput callback")
                    setInterval(this.sendInput, 1000/this.clientTickRate);
                });
                this.sendInput(); // send input back after the tick
            }else{
                console.log("tried to join our own game");
            }
        } else {
            console.log("game dosent exist");
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
            console.log(networking.peers, networking.peers.map(x=>`${x.peerConnection.connectionState}  ${x.peerConnection.iceConnectionState}`))
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

        if(this.swingPos){ obj.data.swinging = this.swingPos }
        if(this.shooting){  obj.data.shooting = true }
        if(this.detonating){ obj.data.detonating = true }
        if(this.map.length === 0){ obj.data.noMap = true }

        if(forSend){
            this.inputX = 0;
            this.inputY = 0;

            // this.shooting = false;

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

    delta = Math.min(delta, 1000); // cap delta time to stop weird things happening when you alt tab

    if (game.isHosting()) {
        if (!gameHost) {
            gameHost = new GameHost();
            game.map = gameHost.map;
            // gameHost.takePlayerInput(networking.id!, game.getInput()) // send input at start
            setInterval(() => { game.sendInput() }, 1000/game.clientTickRate); // game on host machine sending input to gameHost
            networking.setOnPeerLeave(gameHost.onPeerLeave);
        }

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
