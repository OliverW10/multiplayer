import React from "react";
import { gameInfo } from "../networking";
import { isNumeric } from "../utils";
import "./GamesList.css";

interface gameListProps{
    games: Array<gameInfo>;
    show: boolean;
    refresh: ()=>void;
    joinGame: (id: number)=>void;
}

console.log('reloaded')
function GamesList(props: gameListProps){
    const [ idText, setIdText ] = React.useState("");
    const handleOnChange = (evt)=>{
        if(isNumeric(evt.target.value)){
            setIdText(evt.target.value);
        }
    }

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
                            return <GameListItem  key={game.id} {...game} join={props.joinGame}/>
                        })}
                    </tbody>
                </table>
                <div id="gameListBottom">
                    <button onClick={props.refresh}>Refresh</button>
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
}

function GameListItem(props: GameListItemProps){
    const slotsText = props.slots ?? "∞";
    return (
        <tr className="gamesListItem" key={props.id} onClick={e=>props.join(props.id)}>
            <td>{props.id}</td>
            <td>{props.name}</td>
            <td>{props.mode}</td>
            <td>{props.players}/{slotsText}</td>
        </tr>
    )
}

export { GamesList };