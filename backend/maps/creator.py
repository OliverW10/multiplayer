import pygame
import math

from pygame.constants import SCRAP_SELECTION

# map stored as json in following format
# line{
#     p1: {x: number, y: number}
#     p2: {x: number, y: number}
# }

# powerup{
#     p: {x: number, y: number},
#     type: "hp" | "bullet" | "speed",
# }

# map = {
#     lines: array<Line>,
#     powerups: array<powerup>,
#     spawns: array<{x: number, y: number},
#     end zone?: {x, y, w, h}
# }

def floorFor(n, a):
    return math.floor(n*(a)) / (a)
def floorTo(n, to=1):
    return floorFor(n, 10**to)

def roundFor(n, a):
    return round(n*(a)) / (a)
def roundTo(n, to=1):
    return roundFor(n, 10**to)


def mapToScreen(pos, screenSize):
    return (pos[0]*screenSize[0], pos[1]*screenSize[1])
def screenToMap(pos, screenSize):
    return (pos[0]/screenSize[0], pos[1]/screenSize[1])

lines = []

def main():
    pygame.init()
    screen = pygame.display.set_mode((600, 600))
    
    screenSize = screen.get_size()


    pygame.display.flip()
    gridSize = 20
    holding = False
    curStart = (0, 0)
    while 1:
        screen.fill((255, 255, 255))
        mouseButs = pygame.mouse.get_pressed()
        mousePosP = pygame.mouse.get_pos()
        mousePos = screenToMap(mousePosP, screenSize)
        mouseGridPos = ( roundFor(mousePos[0], gridSize), roundFor(mousePos[1], gridSize) )

        event = pygame.event.wait()
        if event.type == pygame.QUIT:
            break
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE or event.unicode == "q":
                break
        
        if holding == False and mouseButs[0] == True:
            curStart = mouseGridPos

        if holding == True and mouseButs[0] == False:
            print(f"line added {curStart} {mouseGridPos}")
            lines.append((curStart, mouseGridPos))
        
        holding = mouseButs[0]

        for l in lines:
            p1 = mapToScreen(l[0], screenSize)
            p2 = mapToScreen(l[1], screenSize)
            pygame.draw.line(screen, (0,0,0), p1, p2)

        if holding:
            p1 = mapToScreen(curStart, screenSize)
            p2 = mapToScreen(mouseGridPos, screenSize)
            pygame.draw.line(screen, (255, 200, 200), p1, p2)

        pygame.draw.circle(screen, pygame.Color("BLACK"), mapToScreen(mouseGridPos, screenSize), 10, 1)

        pygame.display.flip()

    writeMap(lines, [(0.5, 0.5)], "testMap.json")
    pygame.quit()

def writeMap(lines, spawns, name):
    with open(name, "w+") as f:
        f.write("{\n")
        f.write(f'"lines":[')

        first = True
        for line in lines:
            if first:
                first = False
            else:
                f.write(",")
            f.write(f"[{line[0][0]},{line[0][1]},{line[1][0]},{line[1][1]}]")
        f.write(f'],\n"powerups":[],\n"spawns":[')

        first = True
        for spawn in spawns:
            if first:
                first = False
            else:
                f.write(",")
            f.write(f"[{spawn[0]},{spawn[1]}]")
        f.write(']\n}')

if __name__ == "__main__":
    main()