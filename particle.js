import { random, Vector2 } from "./utils.js";
// meant to be controlled by particle group
class Particle {
    // https://www.desmos.com/calculator/9aatwn0u0n
    constructor(start_pos, angle, speed, size) {
        this.drag = 1; // 1 goes to 0 in ~5 seconds
        // size in px, start_pos and speed in world units
        this.pos = start_pos;
        this.vel = new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.size = size;
    }
    render(view) {
        // doset set its own fill colour, should be set by particle group
        const drawPos = this.pos.worldToPixel(view, canvas);
        ctx.beginPath();
        ctx.arc(drawPos.x, drawPos.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
    /**
     *
     * @param dts delta time in seconds
     */
    update(dts) {
        this.vel = this.vel.times(1 - (this.drag * dts));
        this.pos = this.pos.plus(this.vel.times(dts));
    }
}
class ParticleGroup {
    constructor(pos, amount, size, minSpeed, maxSpeed, startCol, endCol, lifetime) {
        this.age = 0;
        this.alive = true;
        this.startCol = startCol;
        this.endCol = endCol;
        this.lifetime = lifetime;
        this.particles = [];
        for (let i = 0; i < amount; i++) {
            this.particles.push(new Particle(pos, random(0, Math.PI * 2), random(minSpeed, maxSpeed), size));
        }
    }
    update(dt) {
        this.age += dt / 1000;
        if (this.age > this.lifetime) {
            this.alive = false;
        }
        if (this.alive) {
            for (let p of this.particles) {
                p.update(dt / 1000);
            }
        }
    }
    render(view) {
        if (this.alive) {
            ctx.fillStyle = this.startCol.lerp(this.endCol, this.age / this.lifetime).toRgb();
            for (let p of this.particles) {
                p.render(view);
            }
        }
    }
}
class ParticleManager {
    constructor() {
        this.groups = [];
    }
}
export class Explosion {
    constructor(pos, size) {
        this.age = 0;
        this.MAX_AGE = 0.3;
        this.alive = true;
        this.pos = pos;
        this.size = size;
    }
    render(view) {
        const drawPos = this.pos.worldToPixel(view, canvas);
        const worldSize = (this.age / this.MAX_AGE) * this.size;
        const outerDrawPos = this.pos.plus(new Vector2(worldSize, 0)).worldToPixel(view, canvas);
        const pixelSize = drawPos.distanceTo(outerDrawPos);
        ctx.beginPath();
        ctx.strokeStyle = "rgb(255, 0, 50)";
        ctx.lineWidth = 3;
        ctx.arc(drawPos.x, drawPos.y, pixelSize, 0, Math.PI * 2);
        ctx.stroke();
    }
    update(dts) {
        this.age += dts;
        if (this.age > this.MAX_AGE) {
            this.alive = false;
        }
    }
}
