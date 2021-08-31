
class Mouse{
    x: number = 0;
    y: number = 0;
    left: boolean = false;
    hasLeft: boolean = false;
    right: boolean = false;
    hasRight: boolean = false;
    middle: boolean = false;
    hasMiddle: boolean = false;

	constructor(){ // canvas: HTMLCanvasElement

		document.addEventListener('mousemove', (evt: MouseEvent) => {
			const rect: DOMRect = canvas.getBoundingClientRect();
			this.x = evt.clientX - rect.left;
			this.y = evt.clientY - rect.top;
		}, false);

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