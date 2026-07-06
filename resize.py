import sys
import os
import cv2

def resize_image(input_path, output_path, width, height, quality=90):
    try:
        # Read the image
        img = cv2.imread(input_path)
        if img is None:
            print("Error: Could not read input image.", file=sys.stderr)
            sys.exit(1)
        
        # Calculate dimensions
        h_orig, w_orig = img.shape[:2]
        if width == 0 and height == 0:
            width, height = w_orig, h_orig
        elif width == 0:
            width = int(w_orig * (height / h_orig))
        elif height == 0:
            height = int(h_orig * (width / w_orig))

        # Perform the resize
        # Using INTER_AREA for shrinking, INTER_CUBIC for enlarging
        if width < w_orig or height < h_orig:
            resized = cv2.resize(img, (width, height), interpolation=cv2.INTER_AREA)
        else:
            resized = cv2.resize(img, (width, height), interpolation=cv2.INTER_CUBIC)
        
        # Determine output format parameters
        _, ext = os.path.splitext(output_path.lower())
        params = []
        if ext in ['.jpg', '.jpeg']:
            params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
        elif ext == '.png':
            # cv2.IMWRITE_PNG_COMPRESSION ranges from 0 (no compression) to 9 (max compression)
            # Higher quality (e.g. 100) = lower compression (0).
            png_compression = int((100 - quality) * 9 / 100)
            params = [int(cv2.IMWRITE_PNG_COMPRESSION), png_compression]
        
        cv2.imwrite(output_path, resized, params)
        print("Success")
    except Exception as e:
        print(f"Error during resize: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 5:
        print("Usage: python resize.py <input_path> <output_path> <width> <height> [quality]", file=sys.stderr)
        sys.exit(1)
    
    in_path = sys.argv[1]
    out_path = sys.argv[2]
    w = int(sys.argv[3])
    h = int(sys.argv[4])
    q = int(sys.argv[5]) if len(sys.argv) > 5 else 90
    
    resize_image(in_path, out_path, w, h, q)
