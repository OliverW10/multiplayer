
class Keyboard{
    /*
    The keys system currently works by adding any key pressed into the keys object
    the key is the key name and the value is a bool of if it is pressed
    */

    keys: { [index:string] : boolean } = {};
    pressedAnyKey: boolean = false; //initially false then true forever after any keypress

    constructor(){
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            this.pressedAnyKey = true;
            // console.log(this.keys)
        });
        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });
    }
    checkKey(key: string): boolean{
        if(key in this.keys){
            return this.keys[key];
        }else{
            return false; // key has never been pressed yet
        }
    }
}

export const keyboard = new Keyboard();
