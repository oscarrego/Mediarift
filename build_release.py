import os
import shutil
import subprocess
import sys
from pathlib import Path

# Paths
PROJECT_ROOT = Path(__file__).parent.resolve()
FRONTEND_DIR = PROJECT_ROOT / "frontend"
BACKEND_DIR = PROJECT_ROOT / "backend"
BIN_DIR = PROJECT_ROOT / "bin"
RELEASE_DIR = Path("C:/Users/oscar/Desktop/MediaRift-Release")

def run_command(cmd, cwd=None, shell=False):
    """Run a shell command and print its output."""
    print(f"\n> Running command: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    print(f"  Working directory: {cwd or os.getcwd()}")
    try:
        result = subprocess.run(cmd, cwd=cwd, shell=shell, check=True, text=True)
        return result
    except subprocess.CalledProcessError as e:
        print(f"Error executing command: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    print("==================================================")
    print("        MediaRift Standalone Build Script         ")
    print("==================================================")

    # 1. Verify environment and files
    print("\n[1/6] Verifying project files...")
    if not (FRONTEND_DIR / "package.json").exists():
        print("Error: frontend/package.json not found!", file=sys.stderr)
        sys.exit(1)
    
    if not (BACKEND_DIR / "app.py").exists():
        print("Error: backend/app.py not found!", file=sys.stderr)
        sys.exit(1)

    ffmpeg_src = BIN_DIR / "ffmpeg.exe"
    ffprobe_src = BIN_DIR / "ffprobe.exe"
    if not ffmpeg_src.exists() or not ffprobe_src.exists():
        print("Error: ffmpeg.exe or ffprobe.exe is missing from bin/ folder!", file=sys.stderr)
        sys.exit(1)
    print("  All core components verified.")

    # 2. Build Frontend assets
    print("\n[2/6] Building React frontend via Vite...")
    run_command(["npm", "run", "build"], cwd=FRONTEND_DIR, shell=True)
    if not (FRONTEND_DIR / "dist").exists() or not (FRONTEND_DIR / "dist" / "index.html").exists():
        print("Error: Frontend build failed to produce frontend/dist/index.html!", file=sys.stderr)
        sys.exit(1)
    print("  Frontend built successfully.")

    # 3. Clean previous PyInstaller builds
    print("\n[3/6] Cleaning up previous PyInstaller builds...")
    for folder in [PROJECT_ROOT / "build", PROJECT_ROOT / "dist"]:
        if folder.exists():
            print(f"  Removing {folder}...")
            shutil.rmtree(folder, ignore_errors=True)

    # 4. Compile Standalone Executable using PyInstaller
    print("\n[4/6] Compiling standalone executable using PyInstaller...")
    run_command(["pyinstaller", "Mediarift.spec", "--clean", "--noconfirm"], cwd=PROJECT_ROOT)
    
    exe_src = PROJECT_ROOT / "dist" / "Mediarift.exe"
    if not exe_src.exists():
        print("Error: PyInstaller build failed to produce dist/Mediarift.exe!", file=sys.stderr)
        sys.exit(1)
    print("  Standalone executable compiled successfully.")

    # 5. Create Separate Release Folder & Copy files
    print(f"\n[5/6] Packaging files into release folder: {RELEASE_DIR}")
    if RELEASE_DIR.exists():
        print(f"  Existing release folder found. Cleaning it...")
        shutil.rmtree(RELEASE_DIR, ignore_errors=True)
    os.makedirs(RELEASE_DIR, exist_ok=True)

    # Copy Mediarift.exe
    print("  Copying Mediarift.exe...")
    shutil.copy2(exe_src, RELEASE_DIR / "Mediarift.exe")

    # Copy ffmpeg and ffprobe
    print("  Copying ffmpeg.exe...")
    shutil.copy2(ffmpeg_src, RELEASE_DIR / "ffmpeg.exe")
    print("  Copying ffprobe.exe...")
    shutil.copy2(ffprobe_src, RELEASE_DIR / "ffprobe.exe")

    # 6. Verify and output release summary
    print("\n[6/6] Verifying release folder contents...")
    expected_files = ["Mediarift.exe", "ffmpeg.exe", "ffprobe.exe"]
    missing = []
    for f in expected_files:
        path = RELEASE_DIR / f
        if path.exists():
            size_mb = path.stat().st_size / (1024 * 1024)
            print(f"  [OK] {f} ({size_mb:.2f} MB)")
        else:
            print(f"  [MISSING] {f}")
            missing.append(f)

    if missing:
        print(f"Error: Some expected release files are missing: {missing}", file=sys.stderr)
        sys.exit(1)

    print("\n==================================================")
    print("              Build Process Complete              ")
    print(f" Release folder: {RELEASE_DIR}")
    print(" Double click Mediarift.exe in that folder to run!")
    print("==================================================")

if __name__ == "__main__":
    main()
