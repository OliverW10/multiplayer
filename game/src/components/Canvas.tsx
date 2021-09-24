import React from "react";
import { Game } from "../game";
import { GameHost } from "../host";
import { networking } from "../networking";
import { UiMessage } from "../";
import "./Canvas.css";


interface CanvasCompProps{
    show: boolean;
    host: boolean;
    messageCallback: (msg: UiMessage)=>void;
}

interface CanvasCompState{

}

export class CanvasComp extends React.Component<CanvasCompProps, CanvasCompState>{
    game?: Game;
    gameHost?: GameHost;
    canvas?: HTMLCanvasElement
    ctx?: CanvasRenderingContext2D;
    inputInterval?: number;
    
    constructor(props){
        super(props);

        this.hookCanvas = this.hookCanvas.bind(this);

        this.startGame = this.startGame.bind(this);
        this.componentDidMount = this.componentDidMount.bind(this);
        this.componentDidUpdate = this.componentDidUpdate.bind(this);
    }

    // runs after render
    componentDidMount(){
        console.log("gamecomp mounted");
        if(this.props.show){
            this.hookCanvas();
            if(!this.game){
                this.startGame();
            }
        }
    }
    componentDidUpdate(){
        if(this.props.show){
            this.hookCanvas();
            if(!this.game){
                this.startGame();
            }
        }
        if(this.props.host){
            if(!this.gameHost){
                this.startHost()
            }
        }
    }

    render(){
        if(this.props.show){
            const handleRightClick = e=>{console.log("prevented right click"); e.preventDefault()}
            return (
                <canvas id="game_canvas" draggable="false" onContextMenu={handleRightClick}></canvas>
            )
        }
        return null
    }

    hookCanvas(){
        console.log("hooked canvas")
        this.canvas = document.getElementById("game_canvas") as HTMLCanvasElement;
        const setCanvasSize = ()=>{
            console.log(`set canvas size to ${window.innerWidth}  ${window.innerHeight}`);
            this.canvas.width = window.innerWidth// || document.documentElement.clientWidth || document.body.clientWidth;
            this.canvas.height = window.innerHeight// || document.documentElement.clientHeight|| document.body.clientHeight;
        }
        window.onresize = setCanvasSize;
        setCanvasSize();

        this.ctx = this.canvas.getContext('2d')
    }

    startGame(){
        console.log("created game objects")
        if(!this.ctx || !this.canvas){
            return;
        }
        this.game = new Game(this.props.messageCallback);
        networking.setOnPeerMsg(this.game.onPeerMsg)
        let gameHost: GameHost | undefined; // dont initialize

        this.inputInterval = window.setInterval(()=>{this.game.sendInput()}, 1000/this.game.clientTickRate)
        this.game.sendInput()
        
        let lastTick: number = performance.now()
        const tick = (nowish: number) => {
            let delta: number = nowish - lastTick;
            lastTick = nowish;

            delta = Math.min(delta, 1000); // cap delta time to stop weird things happening when you alt tab

            if (this.game.isHosting()) {
                if (!this.gameHost) {
                    this.startHost()
                }

                this.gameHost.phyTick(delta);

                this.game.update(delta);
                this.game.render(this.ctx);
            } else {
                // phisUpdates = Math.ceil(delta/physRate)
                if(networking.isReady()){
                    this.game.update(delta);
                    this.game.render(this.ctx);
                }
            }
            if(this.props.show){
                window.requestAnimationFrame(tick);
            }else{
                console.log("stopping animation")
            }
        }
        window.requestAnimationFrame(tick);
    }

    startHost(){
        this.gameHost = new GameHost(this.props.messageCallback);
        this.game.map = this.gameHost.map;
        // gameHost.takePlayerInput(networking.id!, game.getInput()) // send input at start
        // setInterval(() => { this.game.sendInput() }, 1000/this.game.clientTickRate); // game on host machine sending input to gameHost
        networking.setOnPeerLeave(this.gameHost.onPeerLeave);
        networking.setOnPeerMsg(this.gameHost.onPeerMsg)
        networking.setOnHostClientMsg(this.game.onPeerMsg)
    }

    componentWillUnmount(){

    }

}