import React from "react";
import { gameInfo } from "../networking";
import { isNumeric } from "../utils";
import "./GamesList.css";

const reloadIntervalTime = 2000;

interface gameListProps{
    games: Array<gameInfo>;
    show: boolean;
    refresh: ()=>void;
    joinGame: (id: number)=>void;
    myId: number;
}

console.log('reloaded')
function GamesList(props: gameListProps){
    const [ idText, setIdText ] = React.useState("");
    const handleOnChange = (evt)=>{
        if(isNumeric(evt.target.value)){
            setIdText(evt.target.value);
        }
    }

    React.useEffect(()=>{
        let loaderInterval;
        if(props.show){
            loaderInterval = window.setInterval(()=>{console.log("refreshed list");props.refresh();}, reloadIntervalTime)
        }
        return ()=>{
            if(loaderInterval){ window.clearInterval(loaderInterval) }
        }
    })

    if(props.show){
        return (
            <div id="gameListOuter" className="box">
                <table id="gamesList">
                    <thead>
                        <tr className="gamesListItem highlight">
                            <th>Id</th>
                            <th>Game Name</th>
                            <th>Mode</th>
                            <th>Players</th>
                        </tr>
                    </thead>
                    <tbody>
                        {props.games.map(game=>{
                            return <GameListItem myId={props.myId} key={game.id} {...game} join={props.joinGame}/>
                        })}
                    </tbody>
                </table>
                <div id="gameListBottom">
                    <span id="refreshButtonOuter">
                        <button onClick={props.refresh}>Refresh </button>
                        <div className="loader"></div>
                    </span>
                    <span id="idJoinSpan">
                        <label htmlFor="idJoin">Join by id: </label>
                        <input type="text" id="idJoinInput" name="idJoin" value={idText} onChange={handleOnChange}></input>
                        <button onClick={()=>props.joinGame(Number(idText))}>Join</button>
                    </span>
                </div>
            </div>
        )
    }else{
        return null;
    }
}

interface GameListItemProps extends gameInfo{
    join: (e)=>void;
    myId: number;
}

function GameListItem(props: GameListItemProps){
    const slotsText = props.slots ?? "∞";
    const isUs = props.id===props.myId;
    return (
        <tr className={"gamesListItem "+(isUs?"ourGame":"")} key={props.id} onClick={e=>props.join(props.id)}>
            <td className="noselect">{props.id}{isUs?" (you)":""}</td>
            <td className="noselect">{props.name}</td>
            <td className="noselect">{props.mode}</td>
            <td className="noselect">{props.players}/{slotsText}</td>
        </tr>
    )
}

export { GamesList };