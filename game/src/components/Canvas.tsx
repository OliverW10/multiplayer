import React from "react";
import { Game } from "../game";
import { GameHost } from "../host";
import { networking } from "../networking";
import { UiMessage } from "../";


interface CanvasCompProps{
    show: boolean;
    messageCallback: (msg: UiMessage)=>void;
}

interface CanvasCompState{

}

export class CanvasComp extends React.Component<CanvasCompProps, CanvasCompState>{
    game?: Game;
    gameHost?: GameHost;
    canvas?: HTMLCanvasElement
    ctx?: CanvasRenderingContext2D;
    
    constructor(props){
        super(props);

        this.hookCanvas = this.hookCanvas.bind(this);

        this.startGame = this.startGame.bind(this);
        this.componentDidMount = this.componentDidMount.bind(this);
    }

    // runs after render
    componentDidMount(){
        console.log("gamecomp mounted");
        if(this.props.show){
            this.hookCanvas();
            this.startGame();
        }
    }
    componentDidUpdate(){
        if(this.props.show){
            this.hookCanvas();
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

        
        let lastTick: number = performance.now()
        function tick(nowish: number) {
            let delta: number = nowish - lastTick;
            lastTick = nowish;

            delta = Math.min(delta, 1000); // cap delta time to stop weird things happening when you alt tab

            if (this.game.isHosting()) {
                if (!gameHost) {
                    gameHost = new GameHost();
                    this.game.map = gameHost.map;
                    // gameHost.takePlayerInput(networking.id!, game.getInput()) // send input at start
                    setInterval(() => { this.game.sendInput() }, 1000/this.game.clientTickRate); // game on host machine sending input to gameHost
                    networking.setOnPeerLeave(gameHost.onPeerLeave);
                    networking.setOnPeerMsg(gameHost.onPeerMsg)
                    networking.setOnHostClientMsg(this.game.onPeerMsg)
                }

                gameHost.phyTick(delta);

                this.game.update(delta);
                this.game.render(this.ctx);
            } else {
                // phisUpdates = Math.ceil(delta/physRate)
                if(networking.isReady() && this.game.players.length >= 1){
                    this.game.update(delta);
                    this.game.render(this.ctx);
                }
            }
            if(this.props.show){
                window.requestAnimationFrame(tick);
            }
        }
        window.requestAnimationFrame(tick);
    }

    componentWillUnmount(){

    }

}