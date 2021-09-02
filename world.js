import { getLineRect, round, Vector2 } from "./utils.js";
export function checkCollisions(map, curPos, lastPos) {
    let ofInterest = []; // lines who we are in the box collider of
    // for every line
    for (let line of map) {
        // do box check
        const lineBox = getLineRect(line);
        if (lineBox.checkPos(curPos)) {
            ofInterest.push(line);
        }
    }
    // checks if your angle from one end of the line has crossed over 0 since the last update
    for (let line of ofInterest) {
        const lineAngle = line.p1.angleTo(line.p2);
        // find angles from line.p1 to us relative to line
        const curAngle = line.p1.angleTo(curPos) - lineAngle;
        const lastAngle = line.p1.angleTo(lastPos) - lineAngle;
        if (Math.sign(curAngle) !== Math.sign(lastAngle)) { // flipped sides of the line
            if (Math.abs(curAngle) < 0.2) { // to prevent collisions on back side of line (where angles would be ~pi)
                if (line.p1.distanceTo(line.p2) > line.p1.distanceTo(curPos)) { // prevent collisions on far end of line
                    return line;
                }
                else {
                    console.log("passed line far");
                }
            }
            else {
                console.log("passed line close");
            }
        }
    }
}
// checks if two lines have a shared point
function checkShared(l1, l2) {
    return (l1.p1.equals(l2.p1) ||
        l1.p2.equals(l2.p2) ||
        l1.p1.equals(l2.p2));
}
// checks if two lines are parralel
function checkParr(l1, l2) {
    const ang1 = round(l1.p1.angleTo(l1.p2), 3);
    const ang1Inv = round(l1.p2.angleTo(l1.p1), 3);
    const ang2 = round(l2.p1.angleTo(l2.p2), 3);
    return ang2 == ang1 || ang2 == ang1Inv;
}
const MAX_LINE_LENGTH = 5;
// generate map
export function generateMap(size = 20, density = 0.2) {
    let lines = [];
    // create random lines
    for (let i = 0; i < (Math.pow(size, 2)) * density; i++) {
        let x1 = Math.floor(Math.random() * (size - 1)) + 1;
        let y1 = Math.floor(Math.random() * (size - 1)) + 1;
        let x2 = x1 + Math.floor(Math.random() * 3) - 1;
        let y2 = y1 + Math.floor(Math.random() * 3) - 1;
        // to stop starting and ending on the same spot
        while (x1 == x2 && y1 == y2) {
            x2 = x1 + Math.floor(Math.random() * 3) - 1;
            y2 = y1 + Math.floor(Math.random() * 3) - 1;
        }
        lines.push({ p1: new Vector2(x1 / size, y1 / size), p2: new Vector2(x2 / size, y2 / size) });
    }
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
    return lines;
}
