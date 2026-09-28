import subprocess
import os
import sys

def main():
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ]
    
    edge_exe = None
    for p in edge_paths:
        if os.path.exists(p):
            edge_exe = p
            break
            
    if not edge_exe:
        print("Microsoft Edge not found.")
        sys.exit(1)
        
    base_dir = os.path.dirname(os.path.abspath(__file__))
    html_file = os.path.join(base_dir, "CHAINVOTE_TECHNICAL_SECURITY_REPORT.html")
    pdf_file = os.path.join(base_dir, "CHAINVOTE_TECHNICAL_SECURITY_REPORT.pdf")
    
    file_uri = "file:///" + html_file.replace("\\", "/")
    
    cmd = [
        edge_exe,
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_file}",
        file_uri
    ]
    
    print(f"Generating PDF from: {html_file}")
    print(f"Target destination: {pdf_file}")
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    print("Process finished with code:", result.returncode)
    
    if os.path.exists(pdf_file) and os.path.getsize(pdf_file) > 0:
        print(f"SUCCESS: Generated PDF ({os.path.getsize(pdf_file)} bytes)")
    else:
        print("ERROR: PDF was not generated. Stderr:", result.stderr)

if __name__ == "__main__":
    main()
