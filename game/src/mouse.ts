
export class Mouse{
    x: number = 0;
    y: number = 0;
    left: boolean = false;
    right: boolean = false;
    middle: boolean = false;

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
                    break; // what is this? pascal?
                case 1:
                    this.middle = true;
                    break;
                case 2:
                    this.right = true;
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
}