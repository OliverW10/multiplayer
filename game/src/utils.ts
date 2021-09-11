
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
    
    // makes the vector have length 1 from origin
    normalize(): Vector2{
        // creates a new vector2
        let l = Math.sqrt(this.x**2 + this.y**2)
        return new Vector2(this.x/l, this.y/l)
    }
    
    angleFrom(from=new Vector2(0, 0)): number{
        return Math.atan2(this.y-from.x, this.x-from.y);
    }
    angleTo(to: Vector2): number{
        return Math.atan2(to.y-this.y, to.x-this.x)
    }
    length(): number{
        return Math.sqrt(this.x**2 + this.y**2)
    }

    distanceTo(to:Vector2){
        return Math.sqrt((to.x-this.x)**2 + (to.y-this.y)**2)
    }

    // transforms a position from world corodinates to screen percentage
    worldToView(view: Rect): Vector2{
        return new Vector2(
            (this.x-view.x) / view.w,
            (this.y-view.y) / view.h,
        )
    }

    // transforms a position from screen percentage to world cordinates
    viewToWorld(view: Rect): Vector2{
        return new Vector2(
            view.x+(this.x*view.w),
            view.y+(this.y/view.h),
        )
    }

    // transform a screen position 0-1 to pixel cordinate
    screenToPixel(canvas: HTMLCanvasElement): Vector2{
        return new Vector2(scaleNumber(this.x, 0, 1, 0, canvas.width), scaleNumber(this.y, 0, 1, 0, canvas.height))
    }

    // from screen pixels to screen percent
    pixelToScreen(canvas: HTMLCanvasElement): Vector2{
        return new Vector2(scaleNumber(this.x, 0, canvas.width, 0, 1), scaleNumber(this.y, 0, canvas.height, 0, 1))
    }

    // from world to screen pixels
    worldToPixel(view: Rect, canvas: HTMLCanvasElement): Vector2{
        return this.worldToView(view).screenToPixel(canvas)
    }

    // from screen pixels to world codinates
    pixelToWorld(view: Rect, canvas: HTMLCanvasElement): Vector2{
        return this.pixelToScreen(canvas).viewToWorld(view)
    }

   

    interpolate(other:Vector2, n=0.5){
        // n at 1 is other, n at 0 is this
        return new Vector2(this.x*(1-n)+other.x*n ,  this.y*(1-n)+other.y*n)
    }

    minus(other: Vector2): Vector2{
        return new Vector2(this.x-other.x, this.y-other.y)
    }
    plus(other: Vector2): Vector2{
        return new Vector2(this.x+other.x, this.y+other.y)
    }
    times(other: Vector2 | number): Vector2{
        if(typeof(other) === "number"){
            return new Vector2(this.x*other, this.y*other)
        }else{
            return new Vector2(this.x*other.x, this.y*other.y)
        }
    }

    equals(other: Vector2): boolean{
        return other.x===this.x && other.y===this.y;
    }
    // to prevent shallow copying
    copy(): Vector2{
        return new Vector2(this.x, this.y)
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
    checkPos(pos: Vector2): boolean{
        // does a box check for wether the pos is in this
        return (
            pos.x > this.x &&
            pos.x < this.x+this.w &&
            pos.y > this.y &&
            pos.y < this.y+this.h
        ) 
    }

    // transforms a position from world corodinates to screen cordinates
    worldToView(view: Rect): Rect{
        return new Rect(
            (this.x-view.x) / view.w,
            (this.y-view.y) / view.h,
            this.w/view.w,
            this.h/view.h,
        )
    }

    // transform a screen position 0-1 to pixel cordinate
    screenToPixel(canvas: HTMLCanvasElement): Rect{
        return new Rect(this.x*canvas.width, this.y*canvas.height, this.w*canvas.width, this.h*canvas.height)
    }

    // from world to screen pixels
    worldToPixel(view:Rect, canvas: HTMLCanvasElement): Rect{
        return this.worldToView(view).screenToPixel(canvas)
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
export function myRandom(min: number, max: number): number{
    return Math.random()*(max-min)+min;
}

export interface Line{
    p1: Vector2;
    p2: Vector2;
}

export function getLineRect(line: Line, margin = 0.01): Rect{
    // gets an outer bounding rectangle for a line
    const x1 = Math.min(line.p1.x, line.p2.x)-margin;
    const y1 = Math.min(line.p1.y, line.p2.y)-margin;
    const x2 = Math.max(line.p1.x, line.p2.x)+margin;
    const y2 = Math.max(line.p1.y, line.p2.y)+margin;
    
    return new Rect(x1, y1, x2-x1, y2-y1)
}

function lerp(a:number, b:number, n:number): number{
    return a*(1-n) + b*n;
}

export class Colour{
    // holds three number, can be rgb or hsl. as well as a alpha
    a: number;
    b: number;
    c: number;
    alpha: number;
    constructor(a: number, b:number, c:number, alpha: number){
        this.a = a;
        this.b = b;
        this.c = c;
        this.alpha = alpha;
    }
    lerp(other: Colour, n: number = 0.5){
        return new Colour(
            lerp(this.a, other.a, n),
            lerp(this.b, other.b, n),
            lerp(this.c, other.c, n),
            lerp(this.alpha, other.alpha, n)
        )
    }
    toRgb(): string{
        return `rgba(${this.a}, ${this.b}, ${this.c}, ${this.alpha})`
    }
    toHsl(): string{
        return `hsla(${this.a}, ${this.b}, ${this.c}, ${this.alpha})`
    }
}