import React, { GetDerivedStateFromProps, useEffect } from 'react';
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
    if(!props.visable && doDraw){
        console.log("setting loader hide timeout");
        setTimeout(()=>setDraw(false), 500);
    }
    
    if(doDraw){
        // when props.visable is set to false,
        // add hide class to fade out
        // and set timeout to stop rendering
        return (
            <div id="loader" className={props.visable?"":"hide"}>{props.children}</div>
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
    setPlaying,
    setHosting,
}

interface genericUiMsg{
    type: UiMessageTypes;
    data?: any;
}
// interface setGamesMsg{
//     type: UiMessageTypes.setGames;
//     data: Array<gameInfo>;
// }

// interface setPlayingMsg {
//     type: UiMessageTypes.setPlaying;
//     data: boolean;
// }
// interface setHostingMsg {
//     type: UiMessageTypes.setHosting;
//     data: boolean;
// }

export type UiMessage = genericUiMsg// | setGamesMsg | setPlayingMsg | setHostingMsg;

export enum gameTypes{
    pvp="pvp",
    race="race",
}

export const App: React.FC = (props) => {
    const [isPlaying, setPlaying] = React.useState(false);
    const [isHosting, setHosting] = React.useState(false);
    const [showGamesList, setShowGameList] = React.useState(true);
    const [gamesList, setGamesList] = React.useState([] as Array<gameInfo>);
    const [showLoader, setShowLoader] = React.useState(true)
    const [gameSettings, setGameSettings] = React.useState(
        {
            public: false,
            name: "Default game",
            mode: gameTypes.pvp,
            slots: 99,
        } as gameSettings
    )

    // recive a message from a lower level component (e.g. the game)
    // to change some other part of the ui
    const reciveMessage = (msg: UiMessage)=>{
        if(msg.type === UiMessageTypes.showGamesList){ setShowGameList(true) }
        if(msg.type === UiMessageTypes.hideGamesList){ setShowGameList(false) }
        if(msg.type === UiMessageTypes.setGames){ setGamesList(msg.data) }
        if(msg.type === UiMessageTypes.setPlaying){ setPlaying(msg.data) }
        if(msg.type === UiMessageTypes.setHosting){ setHosting(msg.data) }
    }
    networking.setUiMessage(reciveMessage)

    networking.onServerOpen = ()=>{
        setShowLoader(false)
    }

    // run only initially
    React.useEffect(()=>{
        // default on new peer wait for someone to join and then sets us as the host
        networking.setOnNewPeer(()=>{
            setPlaying(true);
            if(networking.hosting){
                setHosting(true)
            }
        })
    }, []); // only runs on mount

    // run every time component is updated
    // if it only runs on mount a closure is created and showGamesList is not updated
    React.useEffect(()=>{
        let escCallback = (e)=>{
            if(e.code === "Escape"){
                console.log(`toggled game list ${showGamesList} ${setShowGameList}`);
                setShowGameList( (!showGamesList) )
            }
        }
        document.addEventListener("keydown", escCallback)
        return ( ()=>{document.removeEventListener("keydown", escCallback)} )
    })

    type gameSettingKeys = keyof gameSettings;
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
        networking.setVis(to);
        setSetting("public", to);        
    }
    const setName = (to: string)=>{
        networking.setName(to);
        setSetting("name", to);
    }
    const setMode = (to: gameTypes)=>{
        networking.setMode(to);
        setSetting("mode", to);
    }
    const creatorProps = {
        setPublic: setPublic,
        setName: setName,
        setMode: setMode,
        id: networking.id,
    }

    const refreshGameList = ()=>networking.getGames( (l:Array<gameInfo>) => { setGamesList(l) } )
    
    const joinGame = (id: number)=>{
        console.log("join callback")
        // if you try to join a game set on new peer to start sending input
        // begin sending input
        networking.joinGame(id);
    }
    
    return (
        <div id="uiOuter">
            <Loader visable={showLoader}>Connecting to server...</Loader>
            <GamesList myId={networking.id}show={showGamesList} games={gamesList} joinGame={joinGame} refresh={refreshGameList} />
            <GameCreator show={showGamesList} settings={gameSettings} {...creatorProps}/>
            <CanvasComp show={isPlaying} host={isHosting} messageCallback={reciveMessage}/>
        </div>
    )
}

const app = document.getElementById("react_container");
ReactDOM.render(<App />, app);