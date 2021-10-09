import { Vector2 } from "./utils";

class Mouse{
    pos: Vector2 = new Vector2(0, 0);
    posF: Vector2 = new Vector2(0, 0); // float pos (as a percentage of document size)
    left: boolean = false;
    hasLeft: boolean = false;
    right: boolean = false;
    hasRight: boolean = false;
    middle: boolean = false;
    hasMiddle: boolean = false;

    onMouseMove: (e: MouseEvent)=>void;

	constructor(){ // canvas: HTMLCanvasElement

        this.onMouseMove = (evt: MouseEvent) => {
			const rect: DOMRect = document.body.getBoundingClientRect();
			this.pos.x = evt.clientX - rect.left;
			this.pos.y = evt.clientY - rect.top;

            this.posF.x = this.pos.x/rect.width;
            this.posF.y = this.pos.y/rect.height;
		}
        this.onMouseMove = this.onMouseMove.bind(this)
		document.addEventListener('mousemove', this.onMouseMove, false);

		document.addEventListener('mousedown', (event: MouseEvent) => {
            switch(event.button){
                case 0:
                    this.left = true;
                    this.hasLeft = true;
                    break;
                case 1:
                    this.middle = true;
                    this.hasMiddle = true;
                    break;
                case 2:
                    this.right = true;
                    this.hasRight = true;
            }
            console.log(this)
		});
		document.addEventListener('mouseup', (event: MouseEvent) => {
			switch(event.button){
                case 0:
                    this.left = false;
                    break;
                case 1:
                    this.middle = false;
                    break;
                case 2:
                    this.right = false;
            }
		});
	}

    // wether the button has been clicked since last call to this
    hasClicked(which: "left" | "middle" | "right"): boolean {
        if(this[which]){
            this[which] = false;
            return true
        }
        return false
    }
}

export const mouse = new Mouse();