
export function showText(ctx: CanvasRenderingContext2D, text: string, X: number, Y: number, Size: number, colour: string = "rgb(0, 0, 0)", stroke: boolean = false) {
    ctx.beginPath();
    ctx.font = Size + "px Arial"
    ctx.textAlign = "center";
    if (stroke === false) {
        ctx.fillStyle = colour;
        ctx.fillText(text, X, Y);
    }
    if (stroke === true) {
        ctx.lineWidth = Size / 25;
        ctx.strokeStyle = colour;
        ctx.strokeText(text, X, Y)
    }
}

export class Vector2{
    x: number;
    y: number;
    constructor(x: number, y: number){
        this.x = x;
        this.y = y;
    }
    
    normalize(): Vector2{
        // creates a new vector2
        let l = Math.sqrt(this.x**2 + this.y**2)
        return new Vector2(this.x/l, this.y/l)
    }

    // transforms a position from world corodinates to screen cordinates
    worldToView(view: Rect): Vector2{
        return new Vector2(
            (this.x-view.x) / view.w,
            (this.y-view.y) / view.h,
        )
    }

    // transform a screen position 0-1 to pixel cordinate
    screenToPixel(canvas: HTMLCanvasElement): Vector2{
        return new Vector2(scaleNumber(this.x, 0, 1, 0, canvas.width), scaleNumber(this.y, 0, 1, 0, canvas.height))
    }

    // from world to screen pixels
    worldToPixel(view:Rect, canvas: HTMLCanvasElement): Vector2{
        return this.worldToView(view).screenToPixel(canvas)
    }

    interpolate(other:Vector2, n=0.5){
        // n at 1 is other, n at 0 is this
        return new Vector2(this.x*(1-n)+other.x*n ,  this.y*(1-n)+other.y*n)
    }
}

export class Rect{
    x: number;
    y: number;
    w: number;
    h: number;
    constructor(x: number, y: number, w: number, h: number){
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }
    NW(): Vector2{
        return new Vector2(this.x, this.y)
    }
    NE(): Vector2{
        return new Vector2(this.x+this.w, this.y)
    }
    SW(): Vector2{
        return new Vector2(this.x, this.y+this.h)
    }
    SE(): Vector2{
        return new Vector2(this.x+this.w, this.y+this.h)
    }
    middle(): Vector2{
        return new Vector2(this.x+this.w/2, this.y+this.h/2)
    }
    setMid(pos: Vector2){
        this.x = pos.x-this.w/2
        this.y = pos.y-this.h/2
    }
}

// scales a number from range x1-x2 to range z1-z2
export function scaleNumber(n: number, x1: number, x2: number, z1: number, z2: number, doClamp = false): number{
	var range1 = x2-x1;
	var range2 = z2-z1;
	var ratio = (n - x1) / range1
    var result = ratio * range2 + z1
    if(doClamp){
    	return clamp(result, z1, z2);
    }else{
    	return result;
    }
}

export function clamp(n: number, min: number, max: number): number{
	return Math.min(Math.max(n, min), max);
}
// ctx.fillStyle = "#"+Math.floor(Math.random()*16777215).toString(16); // random colour

export function round(n: number, to=0){
    let power = 10**to;
    return Math.round(n*power)/power;
}