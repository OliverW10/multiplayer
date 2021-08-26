import { World } from "./game.js";
import { Keyboard } from "./keyboard.js";
import { Mouse } from "./mouse.js"
import { playerData } from "./networking.js";
import { getLineRect, Rect, Vector2 } from "./utils.js";


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
    wasSwinging = false;

    SWING_COOLDOWN = 1.5;

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

    // static drawPlayer(x: number, y: number, angle: number){
    //     // takes in pixel cordinates
        
    // }

    render(canvas: HTMLCanvasElement, camera: Rect) { 
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
        ctx.beginPath();
        ctx.strokeStyle = "gray";
        ctx.lineWidth = 6;
        ctx.arc(drawPos.x, drawPos.y, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(drawPos.x, drawPos.y);
        ctx.lineTo(drawPos.x+Math.cos(this.angle)*30, drawPos.y+Math.sin(this.angle)*30);
        ctx.stroke()
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
            // this.pos.y = displacment.y;
            this.wasSwinging = true;
        }else{
            if(this.wasSwinging === true){
                this.recentlySwung.push({p: this.swingPos, t:this.SWING_COOLDOWN});
            }

            for(let pos of this.recentlySwung){pos.t -= dts;} // decriment timer
            this.recentlySwung = this.recentlySwung.filter(x=>x.t>0) // remove old ones
            
            this.speed += this.inputY * dts * this.ACCEL;
            this.angle += this.inputX * dts * this.TURN;

            this.speed *= 1-(0.1*dts)

            this.pos.x += dts * Math.cos(this.angle) * this.speed;
            this.pos.y += dts * Math.sin(this.angle) * this.speed;
            this.wasSwinging = false;
        }

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
            if(player.swingPos){
                this.swingPos = new Vector2(player.swingPos.x, player.swingPos.y);
                this.swinging = true;
                this.swingDist = this.pos.distanceTo(this.swingPos);
            }else{
                this.swinging = false;
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
        }
        if(this.swinging){
            temp["swingPos"] = this.swingPos;
        }
        return temp;
    }

    // grab(pos: Vector2){
    //     this.swingPos = pos;
    //     this.swinging = true;
    // }
    // ungrab(){
    //     this.swinging = false;
    // }
}