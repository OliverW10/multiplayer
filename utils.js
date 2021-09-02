export function showText(ctx, text, X, Y, Size, colour = "rgb(0, 0, 0)", stroke = false) {
    ctx.beginPath();
    ctx.font = Size + "px Arial";
    ctx.textAlign = "center";
    if (stroke === false) {
        ctx.fillStyle = colour;
        ctx.fillText(text, X, Y);
    }
    if (stroke === true) {
        ctx.lineWidth = Size / 25;
        ctx.strokeStyle = colour;
        ctx.strokeText(text, X, Y);
    }
}
export class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    // makes the vector have length 1 from origin
    normalize() {
        // creates a new vector2
        let l = Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
        return new Vector2(this.x / l, this.y / l);
    }
    angleFrom(from = new Vector2(0, 0)) {
        return Math.atan2(this.y - from.x, this.x - from.y);
    }
    angleTo(to) {
        return Math.atan2(to.y - this.y, to.x - this.x);
    }
    length() {
        return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
    }
    distanceTo(to) {
        return Math.sqrt(Math.pow((to.x - this.x), 2) + Math.pow((to.y - this.y), 2));
    }
    // transforms a position from world corodinates to screen cordinates
    worldToView(view) {
        return new Vector2((this.x - view.x) / view.w, (this.y - view.y) / view.h);
    }
    // transform a screen position 0-1 to pixel cordinate
    screenToPixel(canvas) {
        return new Vector2(scaleNumber(this.x, 0, 1, 0, canvas.width), scaleNumber(this.y, 0, 1, 0, canvas.height));
    }
    // from world to screen pixels
    worldToPixel(view, canvas) {
        return this.worldToView(view).screenToPixel(canvas);
    }
    interpolate(other, n = 0.5) {
        // n at 1 is other, n at 0 is this
        return new Vector2(this.x * (1 - n) + other.x * n, this.y * (1 - n) + other.y * n);
    }
    minus(other) {
        return new Vector2(this.x - other.x, this.y - other.y);
    }
    plus(other) {
        return new Vector2(this.x + other.x, this.y + other.y);
    }
    times(other) {
        if (typeof (other) === "number") {
            return new Vector2(this.x * other, this.y * other);
        }
        else {
            return new Vector2(this.x * other.x, this.y * other.y);
        }
    }
    equals(other) {
        return other.x === this.x && other.y === this.y;
    }
    // to prevent shallow copying
    copy() {
        return new Vector2(this.x, this.y);
    }
}
export class Rect {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }
    NW() {
        return new Vector2(this.x, this.y);
    }
    NE() {
        return new Vector2(this.x + this.w, this.y);
    }
    SW() {
        return new Vector2(this.x, this.y + this.h);
    }
    SE() {
        return new Vector2(this.x + this.w, this.y + this.h);
    }
    middle() {
        return new Vector2(this.x + this.w / 2, this.y + this.h / 2);
    }
    setMid(pos) {
        this.x = pos.x - this.w / 2;
        this.y = pos.y - this.h / 2;
    }
    checkPos(pos) {
        // does a box check for wether the pos is in this
        return (pos.x > this.x &&
            pos.x < this.x + this.w &&
            pos.y > this.y &&
            pos.y < this.y + this.h);
    }
    // transforms a position from world corodinates to screen cordinates
    worldToView(view) {
        return new Rect((this.x - view.x) / view.w, (this.y - view.y) / view.h, this.w / view.w, this.h / view.h);
    }
    // transform a screen position 0-1 to pixel cordinate
    screenToPixel(canvas) {
        return new Rect(this.x * canvas.width, this.y * canvas.height, this.w * canvas.width, this.h * canvas.height);
    }
    // from world to screen pixels
    worldToPixel(view, canvas) {
        return this.worldToView(view).screenToPixel(canvas);
    }
}
// scales a number from range x1-x2 to range z1-z2
export function scaleNumber(n, x1, x2, z1, z2, doClamp = false) {
    var range1 = x2 - x1;
    var range2 = z2 - z1;
    var ratio = (n - x1) / range1;
    var result = ratio * range2 + z1;
    if (doClamp) {
        return clamp(result, z1, z2);
    }
    else {
        return result;
    }
}
export function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
}
// ctx.fillStyle = "#"+Math.floor(Math.random()*16777215).toString(16); // random colour
export function round(n, to = 0) {
    let power = Math.pow(10, to);
    return Math.round(n * power) / power;
}
export function random(min, max) {
    return Math.random() * (max - min) + min;
}
export function getLineRect(line, margin = 0.01) {
    // gets an outer bounding rectangle for a line
    const x1 = Math.min(line.p1.x, line.p2.x) - margin;
    const y1 = Math.min(line.p1.y, line.p2.y) - margin;
    const x2 = Math.max(line.p1.x, line.p2.x) + margin;
    const y2 = Math.max(line.p1.y, line.p2.y) + margin;
    return new Rect(x1, y1, x2 - x1, y2 - y1);
}
function lerp(a, b, n) {
    return a * (1 - n) + b * n;
}
export class Colour {
    constructor(a, b, c, alpha) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.alpha = alpha;
    }
    lerp(other, n = 0.5) {
        return new Colour(lerp(this.a, other.a, n), lerp(this.b, other.b, n), lerp(this.c, other.c, n), lerp(this.alpha, other.alpha, n));
    }
    toRgb() {
        return `rgba(${this.a}, ${this.b}, ${this.c}, ${this.alpha})`;
    }
    toHsl() {
        return `hsla(${this.a}, ${this.b}, ${this.c}, ${this.alpha})`;
    }
}
