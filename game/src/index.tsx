import React, { GetDerivedStateFromProps } from 'react';
import ReactDOM from 'react-dom';
import { CanvasComp } from './components/Canvas';
import { GameCreator, gameSettings } from './components/GameCreator';
import { GamesList } from './components/GamesList';
import { gameInfo, networking } from './networking';
import "./index.css";


interface LoaderProps{
    visable: boolean,
}

export const Loader: React.FC<LoaderProps> = (props)=>{
    const [ doDraw, setDraw ] = React.useState(true);
    React.useEffect(() => {
        if(!props.visable){
            setTimeout(()=>setDraw(false), 500)
        }
    }, [props.visable]);
    
    if(doDraw){
        // when props.visable is set to false,
        // add hide class to fade out
        // and set timeout to stop rendering
        return (
            <div id="loader" className={props.visable?"hide":""}>{props.children}</div>
        )
    }else{
        return null
    }
}


export enum UiMessageTypes {
    showGamesList,
    hideGamesList,
    setGames,
    setLobbyInfo,
}

interface showGamesListMsg {
    type: UiMessageTypes.showGamesList;
}
interface hideGamesListMsg {
    type: UiMessageTypes.hideGamesList;
}
interface setGamesMsg{
    type: UiMessageTypes.setGames;
    data: Array<gameInfo>;
}

export type UiMessage = showGamesListMsg | hideGamesListMsg | setGamesMsg;

export enum gameType{
    pvp="PvP",
    race="Race",
}

export const App: React.FC = (props) => {
    const [isPlaying, setPlaying] = React.useState(false);
    const [showGamesList, setShowGameList] = React.useState(true);
    const [gamesList, setGamesList] = React.useState([] as Array<gameInfo>);
    const [showLoader, setShowLoader] = React.useState("Connecting to server...")
    const [gameSettings, setGameSettings] = React.useState(
        {
            public: false,
            name: "Default game",
            mode: gameType.pvp,
            slots: 99,
        } as gameSettings)

    // recive a message from a lower level component (e.g. the game)
    // to change some other part of the ui
    const reciveMessage = (msg: UiMessage)=>{
        if(msg.type === UiMessageTypes.showGamesList){ setShowGameList(true) }
        if(msg.type === UiMessageTypes.hideGamesList){ setShowGameList(false) }
        if(msg.type === UiMessageTypes.setGames){ setGamesList(msg.data) }
    }

    networking.onServerOpen = ()=>{
        setShowLoader("")
    }

    const setSetting = (which: string, to: any) => {
        const temp: gameSettings = {...gameSettings};
        console.log(Object.keys(temp), which)
        if( !( Object.keys(temp).includes(which) )){
            throw "Invalid key"
        }
        temp[which] = to;
        setGameSettings(temp);
    }

    const setPublic = (to: boolean)=>{
        setSetting("public", to);

    }
    const setName = (to: string)=>setSetting("name", to);
    const setMode = (to: gameType)=>setSetting("mode", to);
    const settingSetters = {
        setPublic: setPublic,
        setName: setName,
        setMode: setMode,
    }
    
    return (
        <div id="uiOuter">
            <Loader visable={showLoader===""}>Connecting</Loader>
            <GamesList show={showGamesList} games={gamesList} />
            <GameCreator show={showGamesList} settings={gameSettings} {...settingSetters}/>
            <CanvasComp show={isPlaying} messageCallback={reciveMessage}/>
        </div>
    )
}

const app = document.getElementById("react_container");
ReactDOM.render(<App />, app);