
import { checkCollisions, World } from "./world";
import { playerInputMessage } from "./networking";
import { clamp, Rect, round, scaleNumber, showText, Vector2 } from "./utils";
import { ctx, canvas } from "./index";


export interface playerData{
    x: number;
    y: number;
    angle: number;
    speed: number;
    id: number;
    swingPos?: Vector2; // if its not there their not holding anything
    lookAngle: number;
    ping: number;
    bulletPos?: Vector2;
    bulletAngle?: number;
    bulletAge?: number;
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

    TURN = 0.8; // multipliers for speed
    ACCEL = 0.015;
    SWING_ACCEL = 0.01;
    SWING_TURN = 0.0;
    MAX_SPEED = 5;
    DRAG = 0.12;
    WALL_BOUNCE = 0.6;

    swingPos = new Vector2(0, 0);
    recentlySwung: Array<{ p: Vector2; t: number; }> = [];
    swingDist = 0;
    swinging = false;
    wasSwinging = false; // was swinging last frame
    wasNetSwinging = false; // was swinging last network tick

    SWING_COOLDOWN = 1.5;

    bulletPos: Vector2 = new Vector2(0, 0); // since each player can have max 1 bullet it dosent make sense to have a seperate class
    bulletAngle: number = 0;
    bulletAge: number = 0;
    bulletAlive: boolean = false;
    BULLET_SPEED = 0.1; // map widths per second
    BULLET_LIFETIME = 3; // seconds
    lastBulletPos: Vector2 = new Vector2(0, 0)
    onCreateExplosion: (pos: Vector2) => void = (_)=>{};

    lookAngle = 0;
    health = 100;

    ping = 0; // used by host only

    constructor(id: number, createBullet: (pos: Vector2)=>void) {
        this.id = id;
        if(createBullet){
            this.onCreateExplosion = createBullet;
        }
    }


    public static fromPlayerData(data: playerData, createBullet: (pos: Vector2)=>void){
        if('id' in data){
            return Object.assign(new Player(data.id, createBullet), data);
        }else{
            throw "tried to create a player without id"
        }
    }

    public static newRandom(id: number, createBullet: (pos: Vector2)=>void): Player{
        let p = new Player(id, createBullet)
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
        // ctx.beginPath();
        // ctx.strokeStyle = "blue";
        // ctx.lineWidth = 10;
        // ctx.beginPath();
        // ctx.moveTo(drawPos.x, drawPos.y);
        // ctx.lineTo(drawPos.x+Math.cos(this.lookAngle)*40, drawPos.y+Math.sin(this.lookAngle)*40);
        // ctx.stroke()

        // body direction indicator
        ctx.beginPath();
        ctx.strokeStyle = "grey"
        ctx.lineWidth = 6;
        ctx.moveTo(drawPos.x, drawPos.y);
        ctx.lineTo(drawPos.x+Math.cos(this.angle)*30, drawPos.y+Math.sin(this.angle)*30);
        ctx.stroke()

        // bullet
        if(this.bulletAlive){
            const bulletDrawPos = this.bulletPos.worldToPixel(camera, canvas);
            ctx.beginPath();
            ctx.fillStyle = "black";
            ctx.arc(bulletDrawPos.x, bulletDrawPos.y, 10, 0, Math.PI * 2);
            ctx.fill();
        }

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

            this.speed *= 1-(this.DRAG*dts)

            this.pos.x += dts * Math.cos(this.angle) * this.speed;
            this.pos.y += dts * Math.sin(this.angle) * this.speed;
            this.wasSwinging = false;
        }

        /////////// COLLISION //////////
        const colLine = checkCollisions(map, this.pos, this.lastPos)
        if(colLine){
            this.pos = this.lastPos;
            this.speed *= this.WALL_BOUNCE;

            const lineAngle = colLine.p1.angleTo(colLine.p2)
            // find angles from line.p1 to us relative to line
            const curAngle = colLine.p1.angleTo(this.pos) - lineAngle

            const normal = lineAngle - (Math.sign(curAngle)*Math.PI/2) // line angle +- half pi
            const angleToNormal = normal-(this.angle-Math.PI);
            console.log(this.angle, normal)
            this.angle = normal + angleToNormal;
            console.log("hit line")
        }

        //////////// BULLET /////////////////
        if(this.bulletAlive){
            this.bulletPos.x += Math.cos(this.bulletAngle) * this.BULLET_SPEED * dts;
            this.bulletPos.y += Math.sin(this.bulletAngle) * this.BULLET_SPEED * dts;
            this.bulletAge += dts;
            if(this.bulletAge > this.BULLET_LIFETIME){
                this.bulletAlive = false;
            }
        
            const bulletColLine = checkCollisions(map, this.bulletPos, this.lastBulletPos)
            if(bulletColLine){
                this.bulletAlive = false;
                this.onCreateExplosion(this.bulletPos)
            }

            this.lastBulletPos = this.bulletPos.copy()
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
            if(player.bulletPos && player.bulletAngle && player.bulletAge){
                [this.bulletPos.x, this.bulletPos.y] = [player.bulletPos.x, player.bulletPos.y];
                this.bulletAngle = player.bulletAngle;
                this.bulletAge = player.bulletAge;
                this.bulletAlive = true;
            }else{
                if(this.bulletAlive){
                    this.bulletAlive = false;
                    this.onCreateExplosion(this.bulletPos)
                }
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
        if(this.bulletAlive){
            temp["bulletAge"] = this.bulletAge;
            temp["bulletAngle"] = this.bulletAngle;
            temp["bulletPos"] = this.bulletPos;
        }
        return temp;
    }

    setLookAngle(angle: number): void{
        this.lookAngle = angle;
    }

    // host takes client input
    takeInput(msg: playerInputMessage, map: World){
        this.inputX = clamp(msg.data.inputX, -1, 1);
        this.inputY = clamp(msg.data.inputY, -1, 1);
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
            if(this.bulletAlive === false){
                this.bulletAlive = true;
                this.bulletPos = this.pos.copy();
                this.bulletAge = 0;
                this.bulletAngle = this.angle; // this.lookAngle
            }
        }
        if(msg.data.detonating){
            if(this.bulletAlive){
                this.bulletAlive = false;
                this.onCreateExplosion(this.bulletPos)
            }
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

    /**
     * 
     * @param pos 
     * @param size size of impulse 
     * @param speed speed per seoncd to give if at pos, linearly goes to zero at size distance
     * @param dmg damage to inflict if at pos, ^
     */
    impulseFrom(pos: Vector2, size: number, speed: number = 0.1, dmg=100){
        const fakeDt = 0.00001;
        const diff = pos.minus(this.pos); // vector to get from player to pos
        const dist = scaleNumber(diff.length(), 0, size, 1, 0);
        if(diff.length() < size){
            let newPos = this.pos.plus( diff.normalize().times( (-1) * dist * speed) ) // move player away from pos by dist * speed
            newPos = newPos.plus(new Vector2(Math.cos(this.angle) * this.speed, Math.sin(this.angle) * this.speed)) // move player as noramlly
            // work out new angle and speed
            this.angle = this.pos.angleTo(newPos);
            this.speed = this.pos.distanceTo(newPos);
        }
    }
}