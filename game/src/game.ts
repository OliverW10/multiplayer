import { Player } from "./player.js"
import { Mouse } from "./mouse.js";
import { Keyboard } from "./keyboard.js"
import { Networking } from "./networking.js"

function showText(ctx: CanvasRenderingContext2D, text:string, X:number, Y:number, Size:number, colour:string = "rgb(0, 0, 0)", stroke:boolean = false){
	ctx.beginPath();
    ctx.font = Size+"px Arial"
	ctx.textAlign = "center";
	if(stroke === false){
		ctx.fillStyle=colour;
		ctx.fillText(text, X, Y);
	}
	if(stroke === true){
		ctx.lineWidth = Size/25;
		ctx.strokeStyle = colour;
		ctx.strokeText(text, X, Y)
	}
}
// ctx.fillStyle = "#"+Math.floor(Math.random()*16777215).toString(16);


export class Game{
    framerate: number = 0;
    canvas: HTMLCanvasElement;
    frametimes: Array<number> = [];
    players: Array<Player> = [];
    networking: Networking

    constructor(canvas:HTMLCanvasElement){
        this.canvas = canvas;

        this.networking = new Networking();
    }

    render(ctx: CanvasRenderingContext2D){
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = "red";
        ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI*2);
        ctx.fill();

        for(let i = 0; i < this.players.length; i++){
            this.players[i].render(ctx);
        }

        showText(ctx, Math.round(this.framerate*100)/100+"fps", 100, 50, 30);
    }

    update(dt: number){
        // dt in ms
        for(let i = 0; i < this.players.length; i++){
            this.players[i].update(dt);
        }

        this.frametimes.push(dt);
        if(this.frametimes.length > 10){
            this.frametimes.shift(); // removes the oldest item
        }
        this.framerate = 1/ (this.frametimes.reduce((a, b)=>a + b)/(1000*this.frametimes.length));
    }
    joinRandomGame(){
        let possibleGames = this.networking.gamesList.filter(x=>x!=this.networking.id)
        this.networking.joinGame(possibleGames[0])
    }
    refreshGamesList(){
        this.networking.wsSend("list-games")
        setTimeout(()=>createGameList(this.networking.gamesList), 1000)
    }
}

// const physsRate: number = 100; // goal framerate for physics

const mouse = new Mouse(canvas);
const keyboard = new Keyboard();


const game = new Game(canvas);

document.getElementById("refreshButton")!.onclick = ()=>{game.refreshGamesList()}
document.getElementById("joinButton")!.onclick = ()=>{game.joinRandomGame()}
document.getElementById("testButton")!.onclick = ()=>{game.networking.dataChannel!.send("this is working YAY!"); console.log("send data")}

function createGameList(list: Array<number>){
    // first clear previouse list
    let prevItems = document.getElementsByClassName("gameListItem")
    if(prevItems){
        for(let item of prevItems){
            item.parentNode!.removeChild(item);
        }
    }
    for(let id of list){
        let trNode = document.createElement("tr");
        trNode.classList.add("gameListItem");

        let nameNode = document.createElement("td");
        let nameText = document.createTextNode("exampleName");
        nameNode.appendChild(nameText);

        let idNode = document.createElement("td");
        let idText = document.createTextNode(id.toString());
        idNode.appendChild(idText);

        let playersNode = document.createElement("td");
        let playersText = document.createTextNode("exampleName");
        playersNode.appendChild(playersText);

        trNode.appendChild(nameNode);
        trNode.appendChild(idNode);
        trNode.appendChild(playersNode);

        document.getElementById("gameList")?.appendChild(trNode);
    }
}

// <tr class="gameListItem">
//     <td>Jill</td>
//     <td>Smith</td>
//     <td>50</td>
// </tr>


let lastTick: number = performance.now()
function tick(nowish: number) {
  let delta: number = nowish - lastTick;
  lastTick = nowish;

  // phisUpdates = Math.ceil(delta/physRate)
  game.update(delta);
  game.render(ctx);

  window.requestAnimationFrame(tick);
}

window.requestAnimationFrame(tick)
