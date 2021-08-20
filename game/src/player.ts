import { Keyboard } from "./keyboard.js";
import { Mouse } from "./mouse.js"

export interface playerState {
    id: number;
    x: number;
    y: number;
    speed: number;
    angle: number;
}

export interface playerAction {
    id: number;
    action: "shoot" | "grab" | "ungrab"
}

export class Player implements playerState {
    x: number = 0;
    y: number = 0;
    targetX: number = 0;
    targetY: number = 0;
    inputX: number = 0;
    inputY: number = 0;
    id: number = 0;
    speed = 0;
    angle = 0;
    targetAngle = 0;

    constructor() {
    }

    public static fromPlayerState(data: playerState){
        Object.assign(this, data);
    }

    render(ctx: CanvasRenderingContext2D) {
        this.x = (this.targetX + this.x)
        
        ctx.beginPath();
        ctx.strokeStyle = "gray";
        ctx.lineWidth = 5;
        ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);

    }
    update(dt: number) {
        this.targetX += dt * Math.cos(this.angle) * this.speed;
        this.targetY += dt * Math.sin(this.angle) * this.speed;
        this.speed *= 1 - (0.05 * dt / 1000); // loses 0.05 per second
    }
    networkUpdate(player: playerState) {
        if (player.id === this.id) {
            this.targetX = player.x;
            this.targetY = player.y;
            this.speed = player.speed;
            this.targetAngle = player.angle;
        }
    }
    controlUpdate(dt: number, keyboard: Keyboard, mouse: Mouse) {
        let dts = dt/1000;
        if(keyboard.checkKey("KeyW")){
            this.speed += dts*0.1
        }
        if(keyboard.checkKey("KeyS")){
            this.speed += dts*0.1
        }
    }
}