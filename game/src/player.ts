import { Keyboard } from "./keyboard.js";
import { Mouse } from "./mouse.js"
import { playerData } from "./networking.js";
import { Rect, Vector2 } from "./utils.js";


export class Player {
    /*
    used by client for keeping track of player to do interpolaten, prediction and rendering
    used by host for simulation and other things
    */
    pos: Vector2 = new Vector2(0, 0);
    id: number;
    speed = 0;
    angle = 0;

    // maybe make vector 2
    inputX = 0; // input x is rotational input
    inputY = 0; // input y is speed input

    angleMulti = 1; // multipliers for speed
    speedMulti = 0.1;

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

    static drawPlayer(x: number, y: number, angle: number){
        // takes in pixel cordinates
        ctx.beginPath();
        ctx.strokeStyle = "gray";
        ctx.lineWidth = 5;
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x+Math.cos(angle)*30, y+Math.sin(angle)*30);
        ctx.stroke()
    }

    render(canvas: HTMLCanvasElement, camera: Rect) { 
        const drawPos = this.pos.worldToPixel(camera, canvas)
        Player.drawPlayer(drawPos.x, drawPos.y, this.angle);
    }
    update(dt: number) {
        const dts = dt/1000;
        this.speed += this.inputY * dts * this.speedMulti;
        this.angle += this.inputX * dts * this.angleMulti;

        this.pos.x += dts * Math.cos(this.angle) * this.speed;
        this.pos.y += dts * Math.sin(this.angle) * this.speed;
        

        // this.x = (this.targetX + this.x)/2; // smoothing because position from networking may be jerky
        // this.y = (this.targetY + this.y)/2; 
    }
    networkUpdate(player: playerData) {
        if (player.id === this.id) {
            this.pos.x = player.x;
            this.pos.y = player.y;
            this.speed = player.speed;
            this.angle = player.angle;
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
        return {
            id: this.id,
            x: this.pos.x,
            y: this.pos.y,
            angle: this.angle,
            speed: this.speed
        }
    }
}