import { Keyboard } from "./keyboard.js";
import { Mouse } from "./mouse.js"

interface PlayerData{
    // object to commnicate player state to and from server
    x: number;
    y: number;
    xVel: number;
    yVel: number;
    id: number;
}

export class Player{
    x: number = 0;
    y: number = 0;
    id: number = 0;
    xVel: number = 0;
    yVel: number = 0;

    constructor(data: PlayerData){
        Object.assign(this, data);
    }
    render(ctx: CanvasRenderingContext2D){  
        ctx.beginPath();
        ctx.strokeStyle = "gray";
        ctx.lineWidth = 5;
        ctx.arc(this.x, this.y, 20, 0, Math.PI*2);
        ctx.stroke();
    }
    update(dt: number){
        this.x += dt * this.xVel;
        this.y += dt * this.xVel;
        this.xVel *= 1-(0.05*dt/1000);
    }
    networkUpdate(player: PlayerData){
        if(player.id === this.id){
            Object.assign(this, player);
        }
    }
    controlUpdate(keyboard: Keyboard, mouse: Mouse){
        
    }
}