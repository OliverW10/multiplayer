class Mouse {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.left = false;
        this.hasLeft = false;
        this.right = false;
        this.hasRight = false;
        this.middle = false;
        this.hasMiddle = false;
        document.addEventListener('mousemove', (evt) => {
            const rect = canvas.getBoundingClientRect();
            this.x = evt.clientX - rect.left;
            this.y = evt.clientY - rect.top;
        }, false);
        document.addEventListener('mousedown', (event) => {
            switch (event.button) {
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
            console.log(this);
        });
        document.addEventListener('mouseup', (event) => {
            switch (event.button) {
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
    hasClicked(which) {
        if (this[which]) {
            this[which] = false;
            return true;
        }
        return false;
    }
}
export const mouse = new Mouse();
