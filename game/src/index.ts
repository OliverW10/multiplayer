

const canvas:HTMLCanvasElement = document.createElement("canvas")
// prevent dragging and right click
canvas.setAttribute('draggable', "false");
document.addEventListener('contextmenu', event => event.preventDefault());
// sets resolution

const setCanvasSize = ()=>{
    canvas.width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    canvas.height = window.innerHeight|| document.documentElement.clientHeight|| document.body.clientHeight;
}
setCanvasSize();
window.onresize = setCanvasSize;

document.body.appendChild(canvas);
const ctx: CanvasRenderingContext2D = canvas.getContext("2d") as CanvasRenderingContext2D;
