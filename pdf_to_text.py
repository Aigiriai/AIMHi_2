import sys
import pdfplumber
import pytesseract
from PIL import Image

def pdf_to_text(pdf_path, txt_path):
    with pdfplumber.open(pdf_path) as pdf:
        with open(txt_path, "w", encoding="utf-8") as txt_file:
            for page in pdf.pages:
                # Try to extract text directly
                text = page.extract_text()
                if text and text.strip():
                    txt_file.write(text + "\n")
                else:
                    # Fallback to OCR if no text found
                    image = page.to_image(resolution=300).original
                    text = pytesseract.image_to_string(image)
                    if text.strip():
                        txt_file.write(text + "\n")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python pdf_to_text.py input.pdf output.txt")
    else:
        pdf_to_text(sys.argv[1], sys.argv[2])