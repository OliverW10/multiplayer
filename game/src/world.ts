import { getLineRect, Line, PRandom, round, Vector2 } from "./utils";

export type World = Array<Line>

/**
 * NOTE: horizontal lines going in -x (left) dont work, please normalize
 * @param map World as list of lines
 * @param curPos 
 * @param lastPos 
 * @returns line cross if any
 */
export function checkCollisions(map: World, curPos: Vector2, lastPos: Vector2): Line | void{
    let ofInterest = []; // lines who we are in the box collider of
    // for every line
    for(let line of map){
        // do box check
        const lineBox = getLineRect(line);
        if(lineBox.checkPos(curPos)){
            ofInterest.push(line);
        }
    }

    // checks if your angle from one end of the line has crossed over 0 since the last update
    for(let line of ofInterest){
        const lineAngle = line.p1.angleTo(line.p2)

        // find angles from line.p1 to us relative to line
        const curAngle = line.p1.angleTo(curPos) - lineAngle;
        const lastAngle = line.p1.angleTo(lastPos) - lineAngle;

        if(Math.sign(curAngle) !== Math.sign(lastAngle)){ // flipped sides of the line
            if(Math.abs(curAngle) < 0.2){ // to prevent collisions on back side of line (where angles would be ~pi)
                if(line.p1.distanceTo(line.p2) > line.p1.distanceTo(curPos)){ // prevent collisions on far end of line
                    return line
                }else{
                    console.log("passed line far")
                }
            }else{
                console.log("passed line close")
            }
        }
    }
}

// checks if two lines have a shared point
function checkShared(l1: Line, l2: Line): boolean{
    return (
        l1.p1.equals(l2.p1) ||
        l1.p2.equals(l2.p2) ||
        l1.p1.equals(l2.p2)
    )
}

// checks if two lines are parralel
function checkParr(l1: Line, l2: Line): boolean{
    const ang1 = round(l1.p1.angleTo(l1.p2), 3);
    const ang1Inv = round(l1.p2.angleTo(l1.p1), 3);
    const ang2 = round(l2.p1.angleTo(l2.p2), 3);
    return ang2 == ang1 || ang2 == ang1Inv;

}
const MAX_LINE_LENGTH = 5;
// generate map
export function generateMap(seed: number, size = 15, density = 0.15): World {
    let lines: World = []
    console.log(`map seed ${seed}`)
    const random = new PRandom(seed);
    // create random lines
    for (let i = 0; i < (size ** 2) * density; i++) {
        let x1 = random.integer(0, size)
        let y1 = random.integer(0, size)
        let x2 = x1 + random.integer(-1, 1)
        let y2 = y1 + random.integer(-1, 1)
        // while the points are on the same spot
        // or they are out of the world
        while((x1==x2 && y1==y2) || x2 > size || x2 < 0 || y2 > size || y2 < 0){
            x2 = x1 + random.integer(-1, 1)
            y2 = y1 + random.integer(-1, 1)
        }
        // fixes horizontal left lines
        if(y1===y2 && x2 < x1){
            [x1, x2] = [x2, x1];
        }
        lines.push({ p1: new Vector2(x1 / size, y1 / size), p2: new Vector2(x2 / size, y2 / size)})
    }
    // create border lines
    lines.push({p1: new Vector2(0, 0), p2: new Vector2(1, 0)}); // top
    lines.push({p1: new Vector2(0, 1), p2: new Vector2(1, 1)}); // bottom
    lines.push({p1: new Vector2(1, 0), p2: new Vector2(1, 1)}); // right
    lines.push({p1: new Vector2(0, 0), p2: new Vector2(0, 1)}); // left

    // let newLines: Map = []
    // // check for long straight lines and combined
    // for(let line of lines){
    //     // for each line check for other lines with shared points
    //     const shareds = lines.filter(x=>checkShared(line, x))
    //     if(shareds.length === 0){
    //         newLines.push(line);
    //     }else{
    //         for(let shared in shareds){
    //             if(checkParr)
    //         }
    //     }
    // }
    return lines
}

// condition should return true to allow
export function findClosestPoint(map: World, pos: Vector2, condition: (Vector2)=>boolean = ()=>true): Vector2{
    let minDist = 9999;
    let minPos = new Vector2(0, 0)
    for(let line of map){
        const dist1 = (line.p1.x-pos.x)**2 + (line.p1.y-pos.y)**2;
        if(dist1 < minDist){
            if(condition(line.p1)){
                minDist = dist1;
                minPos = line.p1;
            }
        }
        const dist2 = (line.p2.x-pos.x)**2 + (line.p2.y-pos.y)**2;
        if(dist2 < minDist){
            if(condition(line.p2)){
                minDist = dist2;
                minPos = line.p2;
            }
        }
    }
    return minPos;
}