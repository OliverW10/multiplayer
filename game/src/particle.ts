import { Colour, myRandom, Rect, round, Vector2 } from "./utils";

// meant to be controlled by particle group
class Particle{
    pos: Vector2;
    vel: Vector2;
    size: number;
    drag = 1; // 1 goes to 0 in ~5 seconds
    // https://www.desmos.com/calculator/9aatwn0u0n

    constructor(start_pos: Vector2, angle: number, speed: number, size: number){
        // size in px, start_pos and speed in world units
        this.pos = start_pos;
        this.vel = new Vector2(Math.cos(angle)*speed, Math.sin(angle)*speed)
        this.size = size;
    }

    render(ctx: CanvasRenderingContext2D, view: Rect){
        // doset set its own fill colour, should be set by particle group

        const drawPos = this.pos.worldToPixel(view, ctx.canvas)
        ctx.beginPath();
        ctx.arc(drawPos.x, drawPos.y, this.size, 0, Math.PI*2)
        ctx.fill()
    }
    /**
     * 
     * @param dts delta time in seconds
     */
    update(dts: number){
        this.vel = this.vel.times(1-(this.drag*dts))
        this.pos = this.pos.plus(this.vel.times(dts))
    }
}

class ParticleGroup{
    // a group of the same colour same size particles
    particles: Array<Particle>
    startCol: Colour;
    endCol: Colour;
    age = 0;
    lifetime: number;
    alive = true;

    constructor(pos: Vector2, amount: number, size: number, minSpeed:number, maxSpeed:number, startCol:Colour, endCol:Colour, lifetime: number){
        this.startCol = startCol;
        this.endCol = endCol;
        this.lifetime = lifetime;
        this.particles = [];
        for(let i = 0; i < amount; i++){
            this.particles.push( new Particle(pos, myRandom(0, Math.PI*2), myRandom(minSpeed, maxSpeed), size))
        }
    }
    update(dt: number){
        this.age += dt/1000;
        if(this.age > this.lifetime){
            this.alive = false;
        }
        if(this.alive){
            for(let p of this.particles){
                p.update(dt/1000)
            }
        }
    }
    render(ctx: CanvasRenderingContext2D, view: Rect){
        if(this.alive){
            ctx.fillStyle = this.startCol.lerp(this.endCol, this.age/this.lifetime).toRgb();
            for(let p of this.particles){
                p.render(ctx, view);
            }
        }
    }
}

export class Explosion{ // TODO: make extend particle group
    pos: Vector2;
    age: number = 0;
    MAX_AGE: number = 0.3;
    size: number;
    alive: boolean = true;
    constructor(pos: Vector2, size: number){
        this.pos = pos;
        this.size = size
    }
    render(ctx: CanvasRenderingContext2D, view: Rect){
        const drawPos = this.pos.worldToPixel(view, ctx.canvas)
        const worldSize = (this.age/this.MAX_AGE) * this.size
        const outerDrawPos = this.pos.plus(new Vector2(worldSize, 0)).worldToPixel(view, ctx.canvas)
        const maxOuterDrawPos = this.pos.plus(new Vector2(this.size, 0)).worldToPixel(view, ctx.canvas)
        const pixelSize = drawPos.distanceTo(outerDrawPos)
        const maxPixelSize = drawPos.distanceTo(maxOuterDrawPos)
        ctx.beginPath();
        ctx.strokeStyle = `rgb(${round(255*this.age/this.MAX_AGE)}, 0, 50)`;
        ctx.lineWidth = 3;
        ctx.arc(drawPos.x, drawPos.y, pixelSize, 0, Math.PI*2);
        ctx.stroke()

        ctx.beginPath();
        ctx.fillStyle = `rgba(70, 0, 50, 0.2)`;
        ctx.arc(drawPos.x, drawPos.y, maxPixelSize, 0, Math.PI*2);
        ctx.fill()
    }
    update(dts: number){
        this.age += dts;
        if(this.age > this.MAX_AGE){
            this.alive = false;
        }
    }
}