import { Player } from "./player"
import { mouse } from "./mouse";
import { keyboard } from "./keyboard"
import { networking, peerInterface, playerInputMessage } from "./networking"
import { showText, Vector2, Rect, round, getLineRect, scaleNumber } from "./utils"
import { GameHost } from "./host";
import { Explosion } from "./particle";
import { generateMap } from "./world";
import { UiMessage, UiMessageTypes } from ".";


// Handles rendering, player input, movement prediction
// will run the same wether you are the host or client
export class Game {
    framerate: number = 0;
    frametimes: Array<number> = [];
    clientTickRate = 30;
    lastTickTime: number = 0; // time since last tick
    timeout = 0; // time since last network message
    age = 0;
    lastPong = 0;

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

    uiCallback: (msgType: UiMessage, data?: any)=>void;

    constructor(uiCallback: (mesType: UiMessage)=>void) {
        this.players = [];
        this.uiCallback = uiCallback;

        this.createExplosion = this.createExplosion.bind(this);
        this.onPeerMsg = this.onPeerMsg.bind(this);
        this.sendInput = this.sendInput.bind(this);

        this.uiCallback({type:UiMessageTypes.hideGamesList})

        console.log("created game")
    }

    createExplosion(pos: Vector2, fromId: number){
        console.log("called create explosion")
        for(let p of this.players){
            if(p.id === fromId){
                p.exploFrom(pos, true);
            }else{
                p.exploFrom(pos, false);
            }
        }
        this.explosions.push(new Explosion(pos, Player.EXPLO_SIZE))
    }


    public onPeerMsg(message: peerInterface): void {
        // console.log(`get message`)
        // console.log(message)
        switch (message.type) {
            case "world-data":
                const mapData = generateMap(message.data)
                for (let lineRaw of mapData) {
                    let line = {
                        p1: new Vector2(lineRaw.p1.x, lineRaw.p1.y),
                        p2: new Vector2(lineRaw.p2.x, lineRaw.p2.y)
                    };
                    if (!this.map.some(x => { x == line })) { // if we dont already have it
                        this.map.push(line)
                    }
                }
                console.log("set map")
                break;
            case "game-state":
                // console.log("got game state")
                // console.log(JSON.stringify(message))
                let curIds = this.players.map(x => x.id)
                for (let player of message.data) {
                    if (curIds.indexOf(player.id) != -1) {
                        const idx = curIds.indexOf(player.id)
                        this.players[idx].networkUpdate(player)
                    } else {
                        console.log(`created new player ${player.id}`) 
                        this.players.push(Player.fromPlayerData(player, this.createExplosion))
                        curIds = this.players.map(x => x.id)
                    }
                }
                // do the pong
                if(Math.random()>0.98){
                    networking.rtcSendObj({type:"pong", frame: message.frame}, -2);
                }
                this.timeout = 0;
                // corrects timer
                this.age = message.frame/GameHost.netTickrate; // age in seconds (tick number / tick rate)
        }
    }

    render(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.beginPath();
        ctx.fillStyle = "red";
        const drawPos = mouse.pos.pixelToWorld(this.viewPos, ctx.canvas).worldToPixel(this.viewPos, ctx.canvas);
        ctx.arc(drawPos.x, drawPos.y, 10, 0, Math.PI*2);
        ctx.fill();

        this.viewPos.w = this.viewPos.h * ctx.canvas.width / ctx.canvas.height

        this.outerViewPos = new Rect(
            this.viewPos.x-this.VIEW_MARGIN/2,
            this.viewPos.y-this.VIEW_MARGIN/2,
            this.viewPos.w+this.VIEW_MARGIN,
            this.viewPos.h+this.VIEW_MARGIN
        );
        // probrobly dont need to call every frame
        this.us = this.getOurPlayer();

        if(this.players.length >= 1){
            this.drawMap(ctx);
            this.drawMinimap(ctx);
            this.drawPlayers(ctx);
        }
        
        if(this.us){
            // speed
            showText(ctx, Math.round(this.us.speed * 1000) / 10 + "/s", ctx.canvas.width/2, ctx.canvas.height-50, 30);
            // timer
            const timerVal = GameHost.GAME_LENGTH_S-this.age
            if(timerVal > 8){
                showText(ctx, Math.round(timerVal) + "s", ctx.canvas.width-100, 50+50/3, 50);
            }else if(timerVal > 3){
                const x = scaleNumber(timerVal, 8, 3, ctx.canvas.width-100, ctx.canvas.width/2);
                const y = scaleNumber(timerVal, 8, 3, 50, ctx.canvas.height/2);
                const s = scaleNumber(timerVal, 8, 3, 50, ctx.canvas.width/5);
                showText(ctx, Math.round(timerVal) + "s", x, y+s/3, s);
            }else{
                const s = scaleNumber(timerVal, 3, 0, ctx.canvas.width/5, ctx.canvas.width/3, true);
                showText(ctx, Math.round(timerVal) + "s", ctx.canvas.width/2, ctx.canvas.height/2+s/3, s);
            }
        }
        if(this.timeout > 2){
            showText(ctx, `timed out for: ${round(this.timeout, 1)}s`, ctx.canvas.width/2, ctx.canvas.height/2, 50, "rgb(200, 20, 20)");
        }
        showText(ctx, Math.round(this.framerate * 100) / 100 + "fps", 100, 50, 30);
    }

    drawMinimap(ctx: CanvasRenderingContext2D){
        // draw minimap
        let minimapRect = { x: ctx.canvas.width - 211, y: ctx.canvas.height - 211, w: 200, h: 200 };
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
                // if(dist < this.viewPos.h*1.5){
                //     var alpha = 1;
                // }else{
                //     var alpha = scaleNumber(dist, this.viewPos.h*1.5, 2, 1, 0, true)
                // }
                const alpha = 1;
                ctx.beginPath();
                ctx.fillStyle = `rgba(100, 50, 50, ${alpha})`
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

    drawMap(ctx: CanvasRenderingContext2D){
        // draw map
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#000";
        // console.log(this.map)
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
                let start = line.p1.worldToPixel(this.viewPos, ctx.canvas)
                ctx.moveTo(start.x, start.y)
                let end = line.p2.worldToPixel(this.viewPos, ctx.canvas)
                ctx.lineTo(end.x, end.y)
                ctx.stroke();
            }
        }

        for(let explo of this.explosions){
            explo.render(ctx, this.viewPos)
        }

        // line showing potential handle
        if(this.us){
            const closesHandle = this.us.findClosestHandle(this.map, mouse.pos.pixelToWorld(this.viewPos, ctx.canvas)).pos;
            // draw handle effect
            ctx.beginPath();
            ctx.strokeStyle = "rgba(150, 150, 150, 0.8)";
            ctx.lineWidth = 5;
            const us = this.getOurPlayer();
            if(us){
                let start = us.pos.worldToPixel(this.viewPos, ctx.canvas)
                ctx.moveTo(start.x, start.y);
                let end = closesHandle.worldToPixel(this.viewPos, ctx.canvas)
                ctx.lineTo(end.x, end.y);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(end.x, end.y, 30, 0, Math.PI*2)
                ctx.stroke();
            }
        }
    }

    drawPlayers(ctx: CanvasRenderingContext2D){
        // our player should be included in players list
        // other players
        for (let p of this.players) {
            p.render(ctx, this.viewPos) // render them
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
            if(mouse.left){
                if(!this.swingPos){
                    const screenSize = new Vector2(document.body.clientWidth, document.body.clientHeight)
                    this.swingPos = us.findClosestHandle(this.map, mouse.pos.pixelToWorld(this.viewPos, screenSize)).pos;
                }
            }else{
                this.swingPos = undefined;
            }
            if(keyboard.checkKeySince("Space")){ // only fires the first frame you have space pressed
                if(us.bulletAlive){
                    this.detonating = true;
                    this.shooting = false;
                }else{
                    this.shooting = true;
                    this.detonating = false;
                }
            }

            const viewTarget = new Vector2(
                us.pos.x + us.speed*Math.cos(us.angle)*this.VIEWPORT_LEAD,
                us.pos.y + us.speed*Math.sin(us.angle)*this.VIEWPORT_LEAD,
            )
            this.viewPos.h = scaleNumber(us.speed, 0, 0.1, 0.25, 0.35, true);
            this.viewPos.setMid(this.viewPos.middle().interpolate(viewTarget, dts*5))
            // this.viewPos.setMid(viewTarget)
            // const ourDrawPos = us.pos.worldToPixel(this.viewPos, canvas);
            // this.lookAngle = ourDrawPos.angleTo( new Vector2(mouse.pos.x, mouse.pos.y));

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
        // let possibleGames = networking.gamesList.filter(x => x != networking.id)
        // networking.joinGame(possibleGames[0])
    }

    // send the server info for this client
    // called this.tickrate times per second
    // also used on host beacuse -2 routes host traffic directly
    sendInput() {
        if (networking.isReady()) { // tests if peer is ready
            networking.rtcSendObj(this.getInput(true), -2);
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

        if(this.swingPos){ obj.data.swingPos = this.swingPos }
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

    isHosting() {
        return networking.hosting
    }
}
