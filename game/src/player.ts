
import { World } from "./host.js";
import { playerInputMessage } from "./networking.js";
import { getLineRect, Rect, round, showText, Vector2 } from "./utils.js";

export interface playerData{
    x: number;
    y: number;
    angle: number;
    speed: number;
    id: number;
    swingPos?: Vector2; // if its not there their not holding anything
    lookAngle: number;
    ping: number;
  }

export class Player {
    /*
    used by client for keeping track of player to do interpolaten, prediction and rendering
    used by host for simulation and other things
    */
    pos: Vector2 = new Vector2(0, 0);
    lastPos: Vector2 = new Vector2(0, 0); // used for collision
    id: number;
    speed = 0;
    angle = 0;

    // maybe make vector 2
    inputX = 0; // input x is rotational input
    inputY = 0; // input y is speed input

    TURN = 1; // multipliers for speed
    ACCEL = 0.015;
    SWING_ACCEL = 0.01;
    SWING_TURN = 0.0;
    MAX_SPEED = 5;

    swingPos = new Vector2(0, 0);
    recentlySwung: Array<{ p: Vector2; t: number; }> = [];
    swingDist = 0;
    swinging = false;
    wasSwinging = false; // was swinging last frame
    wasNetSwinging = false; // was swinging last network tick

    SWING_COOLDOWN = 1.5;

    bulletPos?: Vector2; // since each player can have max 1 bullet it dosent make sense to have a seperate class
    // if bulletPos is undefined there is no bullet
    bulletVel = new Vector2(0, 0);
    bulletAge = 0;

    lookAngle = 0;

    ping = 0; // used by host only

    constructor(id: number) {
        this.id = id;
    }


    public static fromPlayerData(data: playerData){
        if('id' in data){
            return Object.assign(new Player(data.id), data);
        }else{
            throw "tried to create a player without id"
        }
    }

    public static newRandom(id: number): Player{
        let p = new Player(id)
        p.pos.x = Math.random();
        p.pos.y = Math.random();
        return p
    }

    render(camera: Rect) { 
        const drawPos = this.pos.worldToPixel(camera, canvas)
        if(this.swinging){
            const swingDrawPos = this.swingPos.worldToPixel(camera, canvas);
            ctx.beginPath();
            ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
            ctx.lineWidth = 4;
            ctx.moveTo(drawPos.x, drawPos.y);
            ctx.lineTo(swingDrawPos.x, swingDrawPos.y);
            ctx.stroke();
        }

        // body cirlce
        ctx.beginPath();
        ctx.strokeStyle = "gray";
        ctx.lineWidth = 6;
        ctx.arc(drawPos.x, drawPos.y, 20, 0, Math.PI * 2);
        ctx.stroke();

        // turret
        ctx.beginPath();
        ctx.strokeStyle = "blue";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(drawPos.x, drawPos.y);
        ctx.lineTo(drawPos.x+Math.cos(this.lookAngle)*40, drawPos.y+Math.sin(this.lookAngle)*40);
        ctx.stroke()

        // body direction indicator
        ctx.beginPath();
        ctx.strokeStyle = "grey"
        ctx.lineWidth = 6;
        ctx.moveTo(drawPos.x, drawPos.y);
        ctx.lineTo(drawPos.x+Math.cos(this.angle)*30, drawPos.y+Math.sin(this.angle)*30);
        ctx.stroke()

        // ping
        showText(ctx, `id: ${this.id}  ${round(this.ping, 2)}ms`, drawPos.x, drawPos.y-30, 10);
    }
    update(dt: number, map: World) {
        this.lastPos = new Vector2(this.pos.x, this.pos.y);
        const dts = dt/1000;
        if(this.swinging){
            this.swingDist += this.inputX * dts * this.SWING_TURN;
            this.speed += this.inputY * dts * this.SWING_ACCEL;
            // get position relative to handle
            const relPos = this.pos.minus(this.swingPos)
            // find the next position
            const nextPos = new Vector2(
                relPos.x + dts * Math.cos(this.angle) * this.speed,
                relPos.y + dts * Math.sin(this.angle) * this.speed
            )
            // clamp it to the distance
            const clampPos = nextPos.normalize().times(this.swingDist)
            // update the speed
            const displacment = clampPos.minus(relPos) // amount moved this update
            if(this.wasSwinging == false){ // only set speed on first update to prevent unintentional "drag" from rotation
                this.speed = displacment.length()/dts
            }
            // update the angle (maybe need change)
            this.angle = Math.atan2(displacment.y, displacment.x);
            // actuall move player
            this.pos = this.swingPos.plus(clampPos);
            this.wasSwinging = true;
        }else{ // not swinging

            for(let pos of this.recentlySwung){pos.t -= dts;} // decriment swung timer
            this.recentlySwung = this.recentlySwung.filter(x=>x.t>0) // remove old swung poss
            
            this.speed += this.inputY * dts * this.ACCEL;
            this.angle += this.inputX * dts * this.TURN;

            this.speed *= 1-(0.1*dts)

            this.pos.x += dts * Math.cos(this.angle) * this.speed;
            this.pos.y += dts * Math.sin(this.angle) * this.speed;
            this.wasSwinging = false;
        }

        /////////// COLLISION //////////
        let ofInterest = []; // lines who we are in the box collider of
        // for every line
        for(let line of map){
            // do box check
            const lineBox = getLineRect(line);
            if(lineBox.checkPos(this.pos)){
                ofInterest.push(line);
            }
        }

        // checks if your angle from one end of the line has crossed over 0 since the last update
        for(let line of ofInterest){
            const lineAngle = line.p1.angleTo(line.p2)

            // find angles from line.p1 to us relative to line
            const curAngle = line.p1.angleTo(this.pos) - lineAngle
            const lastAngle = line.p1.angleTo(this.lastPos) - lineAngle

            if(Math.sign(curAngle) !== Math.sign(lastAngle)){ // flipped sides of the line
                if(Math.abs(curAngle) < 0.2){ // to prevent collisions on back side of line (where angles would be ~pi)
                    if(line.p1.distanceTo(line.p2) > line.p1.distanceTo(this.pos)){ // prevent collisions on far end of line
                        this.pos = this.lastPos;
                        this.speed *= 0.9;
                        const wrap = (x: number) => {return x%Math.PI*2};
                        const normal = lineAngle - (Math.sign(curAngle)*Math.PI/2) // line angle +- half pi
                        const angleToNormal = normal-(this.angle-Math.PI);
                        console.log(this.angle, normal)
                        this.angle = normal + angleToNormal;
                        console.log("hit line")
                    }else{
                        console.log("passed line far")
                    }
                }else{
                    console.log("passed line close")
                }
            }
        }

        // this.x = (this.targetX + this.x)/2; // smoothing because position from networking may be jerky
        // this.y = (this.targetY + this.y)/2; 
    }

    networkUpdate(player: playerData) {
        if (player.id === this.id) {
            this.pos.x = player.x;
            this.pos.y = player.y;
            this.speed = player.speed;
            this.angle = player.angle;
            this.lookAngle = player.lookAngle;
            this.ping = player.ping
            if(player.swingPos){
                this.swingPos = new Vector2(player.swingPos.x, player.swingPos.y);
                this.swinging = true;
                this.swingDist = this.pos.distanceTo(this.swingPos);
                this.wasNetSwinging = true;
            }else{
                if(this.wasNetSwinging){ // just stopped swinging
                    console.log("added to recently swung")
                    this.recentlySwung.push({p: this.swingPos, t:this.SWING_COOLDOWN});
                }
                this.swinging = false;
                this.wasNetSwinging = false;
            }
        }
    }
    // controlUpdate(dt: number, keyboard: Keyboard, mouse: Mouse) {
    //     let dts = dt/1000;
    //     if(keyboard.checkKey("KeyW")){
    //         this.speed += dts*0.1
    //     }
    //     if(keyboard.checkKey("KeyS")){
    //         this.speed += dts*0.1
    //     }
    // }
    toData(): playerData{
        // returns playerData object for host to send to clients
        let temp: playerData = {
            id: this.id,
            x: this.pos.x,
            y: this.pos.y,
            angle: this.angle,
            speed: this.speed,
            lookAngle: this.lookAngle,
            ping: this.ping
        }
        if(this.swinging){
            temp["swingPos"] = this.swingPos;
        }
        return temp;
    }

    setLookAngle(angle: number): void{
        this.lookAngle = angle;
    }

    // host takes client input
    takeInput(msg: playerInputMessage, map: World){
        this.inputX = msg.data.inputX;
        this.inputY = msg.data.inputY;
        this.lookAngle = msg.data.lookAngle;
        if(msg.data.swinging){ 
            if(!this.swinging){ // only if werent swinging last frame
                console.log("set swinging")
                const closest = this.findClosestHandle(map)
                this.swingPos = closest.pos;
                this.swingDist = closest.dist;
                this.swinging = true;
            }
        }else{
            if(this.swinging){
                this.recentlySwung.push({p: this.swingPos, t:this.SWING_COOLDOWN});
            }
            this.swinging = false;
        }
        if(msg.data.shooting){
            
        }
    }

    findClosestHandle(map: World): {pos:Vector2, dist:number}{
        let minDist = 9999;
        let minPos = new Vector2(0, 0)
        for(let line of map){
            const dist1 = (line.p1.x-this.pos.x)**2 + (line.p1.y-this.pos.y)**2;
            if(dist1 < minDist){
                if(!this.recentlySwung.some((x)=>x.p.equals(line.p1))){
                    minDist = dist1;
                    minPos = line.p1;
                }
            }
            const dist2 = (line.p2.x-this.pos.x)**2 + (line.p2.y-this.pos.y)**2;
            if(dist2 < minDist){
                if(!this.recentlySwung.some((x)=>x.p.equals(line.p2))){
                    minDist = dist2;
                    minPos = line.p2;
                }
            }
        }
        return {pos:minPos, dist:Math.sqrt(minDist)};
    }
}