import os
import sys
import json
import string
from PIL import Image

def is_image_file(filename):
    return filename.lower().endswith((".png", ".jpg", ".jpeg"))

def fixed_crop_top(image, crop_length):
    """Crop a fixed number of pixels from the top of the image."""
    width, height = image.size
    return image.crop((0, crop_length, width, height))

def generate_filename(index, base_number):
    """Generate a filename like 1a, 1b, ..., 1z, 1aa, 1ab, ..."""
    alphabet = string.ascii_lowercase
    name = []
    while index >= len(alphabet):
        index, rem = divmod(index, len(alphabet))
        name.append(alphabet[rem])
        index -= 1
    name.append(alphabet[index])
    return f"{base_number}{"".join(reversed(name))}.png"

def rename_and_convert_images(directory, base_number, crop_length):
    files = sorted([f for f in os.listdir(directory) if is_image_file(f)])
    new_filenames = []

    for index, file in enumerate(files):
        new_name = generate_filename(index, base_number)
        src_path = os.path.join(directory, file)
        dst_path = os.path.join(directory, new_name)

        img = Image.open(src_path).convert("RGBA")
        if crop_length > 0:
            img = fixed_crop_top(img, crop_length)
        img.save(dst_path, format="PNG", optimize=True, compress_level=9)

        if src_path != dst_path:
            os.remove(src_path)

        new_filenames.append(new_name)
    return new_filenames

def create_webp_versions(directory, filenames):
    for filename in filenames:
        png_path = os.path.join(directory, filename)
        webp_path = os.path.splitext(png_path)[0] + ".webp"
        img = Image.open(png_path).convert("RGBA")
        img.save(webp_path, format="WEBP", quality=80)

def main():
    if len(sys.argv) < 3:
        print("Arguments: <directory> <number> [<crop_length>]")
        sys.exit(1)

    directory = sys.argv[1]
    base_number = sys.argv[2]
    crop_length = int(sys.argv[3]) if len(sys.argv) > 3 else 0

    renamed_files = rename_and_convert_images(directory, base_number, crop_length)
    create_webp_versions(directory, renamed_files)

    print(json.dumps(renamed_files, indent=2))

if __name__ == "__main__":
    main()
