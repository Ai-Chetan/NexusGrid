import pygame

# Initialize Pygame
pygame.init()

# Screen dimensions
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Shape Editor")

# Colors
WHITE = (255, 255, 255)
BLUE = (0, 0, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLACK = (0, 0, 0)

# Clock for controlling frame rate
clock = pygame.time.Clock()
FPS = 60

# Shape settings
shape_size = 50
shapes = []  # List to store all shapes
dragging = False  # Track if a shape is being dragged
selected_shape = None  # Track the currently selected shape
edit_mode = True  # Track if editing is enabled

# Button settings
button_font = pygame.font.SysFont("Arial", 20)
add_button_rect = pygame.Rect(10, 10, 100, 40)
save_button_rect = pygame.Rect(120, 10, 100, 40)
edit_button_rect = pygame.Rect(230, 10, 100, 40)

def draw_button(rect, color, text):
    pygame.draw.rect(screen, color, rect)
    text_surface = button_font.render(text, True, BLACK)
    screen.blit(text_surface, (rect.x + 10, rect.y + 10))

def add_shape():
    # Add a new shape at a default position
    shapes.append({"x": WIDTH // 2, "y": HEIGHT // 2, "color": BLUE})

def save_positions():
    # Save the current positions of all shapes
    global edit_mode
    edit_mode = False  # Disable editing

def enable_editing():
    # Enable editing mode
    global edit_mode
    edit_mode = True

def handle_mouse_events():
    global dragging, selected_shape

    # Get mouse position and click status
    mouse_x, mouse_y = pygame.mouse.get_pos()
    mouse_click = pygame.mouse.get_pressed()[0]  # Left mouse button

    if edit_mode:
        # Check if the mouse is over any shape
        if not dragging:
            selected_shape = None
            for shape in shapes:
                if (shape["x"] <= mouse_x <= shape["x"] + shape_size and
                    shape["y"] <= mouse_y <= shape["y"] + shape_size):
                    if mouse_click:
                        dragging = True
                        selected_shape = shape
                    break

        # Move the selected shape if dragging
        if dragging and selected_shape:
            selected_shape["x"] = mouse_x - shape_size // 2
            selected_shape["y"] = mouse_y - shape_size // 2

        # Stop dragging if mouse button is released
        if not mouse_click:
            dragging = False

def draw_shapes():
    for shape in shapes:
        pygame.draw.rect(screen, shape["color"], (shape["x"], shape["y"], shape_size, shape_size))

running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1:  # Left mouse button
                # Check if buttons are clicked
                if add_button_rect.collidepoint(event.pos):
                    add_shape()
                elif save_button_rect.collidepoint(event.pos):
                    save_positions()
                elif edit_button_rect.collidepoint(event.pos):
                    enable_editing()

    # Handle mouse events
    handle_mouse_events()

    # Clear screen
    screen.fill(WHITE)

    # Draw buttons
    draw_button(add_button_rect, GREEN, "Add Shape")
    draw_button(save_button_rect, RED, "Save")
    draw_button(edit_button_rect, BLUE, "Edit")

    # Draw shapes
    draw_shapes()

    # Update display
    pygame.display.flip()

    # Control frame rate
    clock.tick(FPS)

pygame.quit()