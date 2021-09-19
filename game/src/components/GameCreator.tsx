import React from "react"
import { gameType } from ".."
import "./GameCreator.css"


export interface gameSettings{
    public: boolean;
    mode: gameType;
    name: string;
    slots: number;
}

interface CreatorProps{
    show: boolean;
    settings: gameSettings;
    setPublic: (to: boolean)=>void;
    setName: (to: string)=>void;
    setMode: (to: gameType)=>void;
}

export const GameCreator: React.FC<CreatorProps> = (props)=>{
    const [nameText, setNameText] = React.useState("New game")
    const handleNameInput = (event)=>{
        setNameText(event.target.value)
    }
    if(props.show){
        return (
            <div id="gameCreatorOuter" className="box">
                <button onClick={ ()=>props.setPublic(!props.settings.public) }>Public [{props.settings.public?"x":" "}]</button>
                <br></br>
                <span id="nameSpan">
                    <label htmlFor="gameName">Game name: </label>
                    <input type="text" id="gameNameInput" name="gameName" value={nameText} onChange={handleNameInput}></input>
                    <button onClick={()=>props.setName(nameText)}>Set</button>
                </span>
            </div>
        )
    }
    return null
}