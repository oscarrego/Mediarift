import os
import urllib.request
import zipfile
import shutil


def download_file(url, dest):
    print(f"Downloading {url} to {dest}...")
    with urllib.request.urlopen(url) as response, open(dest, 'wb') as out_file:
        shutil.copyfileobj(response, out_file)
    print("Download complete.")

def main():
    project_root = os.path.dirname(os.path.abspath(__file__))
    bin_dir = os.path.join(project_root, "bin")
    os.makedirs(bin_dir, exist_ok=True)

    # We use stable 4.4.1 prebuilt binaries from ffbinaries, which are very compact and reliable
    ffmpeg_url = "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-win-64.zip"
    ffprobe_url = "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffprobe-4.4.1-win-64.zip"

    ffmpeg_zip = os.path.join(bin_dir, "ffmpeg.zip")
    ffprobe_zip = os.path.join(bin_dir, "ffprobe.zip")

    try:
        # Download
        download_file(ffmpeg_url, ffmpeg_zip)
        download_file(ffprobe_url, ffprobe_zip)

        # Extract ffmpeg
        print("Extracting ffmpeg...")
        with zipfile.ZipFile(ffmpeg_zip, 'r') as zip_ref:
            zip_ref.extractall(bin_dir)
        
        # Extract ffprobe
        print("Extracting ffprobe...")
        with zipfile.ZipFile(ffprobe_zip, 'r') as zip_ref:
            zip_ref.extractall(bin_dir)

        print("Binaries extracted successfully.")

    except Exception as e:
        print(f"Error occurred: {e}")
    finally:
        # Clean up
        if os.path.exists(ffmpeg_zip):
            os.remove(ffmpeg_zip)
        if os.path.exists(ffprobe_zip):
            os.remove(ffprobe_zip)

    # Verify files exist
    ffmpeg_exe = os.path.join(bin_dir, "ffmpeg.exe")
    ffprobe_exe = os.path.join(bin_dir, "ffprobe.exe")
    if os.path.exists(ffmpeg_exe) and os.path.exists(ffprobe_exe):
        print(f"Success! ffmpeg and ffprobe are ready in {bin_dir}")
    else:
        print("Verification failed! One or more executables are missing.")

if __name__ == "__main__":
    main()
