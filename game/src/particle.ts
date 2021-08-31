import { Colour, random, Rect, Vector2 } from "./utils";

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

    render(view: Rect){
        // doset set its own fill colour, should be set by particle group

        const drawPos = this.pos.worldToPixel(view, canvas)
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
            this.particles.push( new Particle(pos, random(0, Math.PI*2), random(minSpeed, maxSpeed), size))
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
    render(view: Rect){
        if(this.alive){
            ctx.fillStyle = this.startCol.lerp(this.endCol, this.age/this.lifetime).toRgb();
            for(let p of this.particles){
                p.render(view);
            }
        }
    }
}

class ParticleSystem{
    // group of particle groups
    particleGroups: Array<ParticleGroup> = [];
}

class ParticleManager{

}