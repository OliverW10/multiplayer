import { gameInfo } from "../networking";
import "./GamesList.css";

interface gameListProps{
    games: Array<gameInfo>;
    show: boolean;
}

console.log('reloaded')
function GamesList(props: gameListProps){
    return (
        <div id="gameListOuter" className="box">
            <table id="gamesList">
                <thead>
                    <tr className="gamesListItem highlight">
                        <th>Game Name</th>
                        <th>Mode</th>
                        <th>Players</th>
                    </tr>
                </thead>
                <tbody>
                    {props.games.map(game=>{
                        <GameListItem {...game}/>
                    })}
                </tbody>
            </table>
        </div>
    )
}

function GameListItem(props: gameInfo){
    const slotsText = props.slots ?? "∞";
    return (
        <tr className="gamesListItem">
            {/* title={props.id.toString()} */}
            <td>{props.name}</td>
            <td>{props.mode}</td>
            <td>{props.players}/{slotsText}</td>
        </tr>
    )
}

export { GamesList };