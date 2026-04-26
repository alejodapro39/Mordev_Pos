from PIL import Image
import sys

def convert_to_ico(input_path, output_path):
    img = Image.open(input_path)
    # Resize to common icon sizes
    icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(output_path, format='ICO', sizes=icon_sizes)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert_ico.py input.png output.ico")
    else:
        convert_to_ico(sys.argv[1], sys.argv[2])
