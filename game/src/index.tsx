import React, { GetDerivedStateFromProps } from 'react';
import ReactDOM from 'react-dom';
import { Game } from './game';
import { GameHost } from './host';
import { networking } from './networking';
// import {  } from "./App";

// defined in here so they are global

// const canvas = document.createElement("canvas")
// // prevent dragging and right click
// canvas.setAttribute('draggable', "false");
// document.addEventListener('contextmenu', event => event.preventDefault());
// // sets resolution

// const setCanvasSize = ()=>{
//     canvas.width = window.innerWidth// || document.documentElement.clientWidth || document.body.clientWidth;
//     canvas.height = window.innerHeight// || document.documentElement.clientHeight|| document.body.clientHeight;
// }
// setCanvasSize();
// window.onresize = setCanvasSize;

// document.body.appendChild(canvas);
// const ctx = canvas.getContext("2d");


const App: React.FC = (props) => {
    const [isPlaying, setPlaying] = React.useState(false);
    const [gameList, setGameList] = React.useState(true);

    // recive a message from a lower level component (e.g. the game)
    // to change some other part of the ui
    const reciveMessage = (type: UiMessageType, data?: any)=>{
        if(type === UiMessageType.showGamesList){ setGameList(true) }
        if(type === UiMessageType.hideGamesList){ setGameList(false) }
    }   

    return (
        <div>
            <GamesList show={gameList} games={[]} />
            <GameComp show={isPlaying} messageCallback={reciveMessage}/>
        </div>
    )
}

export enum UiMessageType{
    showGamesList,
    hideGamesList,
}

interface GameCompProps{
    show: boolean;
    messageCallback: (msg: UiMessageType, data?:any)=>void;
}

interface GameCompState{

}

class GameComp extends React.Component<GameCompProps, GameCompState>{
    game?: Game;
    gameHost?: GameHost;
    canvas?: HTMLCanvasElement
    ctx?: CanvasRenderingContext2D;
    
    constructor(props){
        super(props);

        // run after this component is mounted
        const _effectCallback = ()=>{
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
        const effectCallback = _effectCallback.bind(this);
        React.useEffect(effectCallback);

        this.startGame = this.startGame.bind(this);
        this.componentDidMount = this.componentDidMount.bind(this);
    }

    componentDidMount(){
        console.log("gamecomp mounted");
        this.startGame();
    }

    render(){
        if(this.props.show){
            const handleRightClick = e=>{console.log("prevented right click"); e.preventDefault()}
            return (
                <canvas id="game_canvas" draggable="false" onContextMenu={handleRightClick}></canvas>
            )
        }
    }

    startGame(){
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
                this.game.render(c);
            } else {
                // phisUpdates = Math.ceil(delta/physRate)
                if(networking.isReady() && this.game.players.length >= 1){
                    this.game.update(delta);
                    this.game.render(c);
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

function GamesList(props){
    return (
        <table>
            {props.games.map(x=>{
                <GameListItem id={x}/>
            })}
        </table>
    )
}

function GameListItem(props){
    return (
        <tr class="gameListItem">
            <td>Jill</td>
            <td>Smith</td>
            <td>{props.id}</td>
        </tr>
    )
}


const app = document.getElementById("react_container");
ReactDOM.render(<App />, app);