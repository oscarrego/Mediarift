# Business Requirements & Deployment Document (BRD) - MediaRift

## 📋 1. Business Overview & Objective
Modern web users frequently need to retrieve online media content, convert image assets, strip audio tracks, or convert text documents (such as PDF/DOCX) for formatting. Existing free solutions are flooded with malicious advertisements, tracking scripts, and subscription paywalls. Paid options are cost-prohibitive for casual developers.

**MediaRift** delivers a private, lightweight, and fully open-source fullstack solution. It runs both as a zero-installation native desktop application (wrapping the backend) and as a robust web service deployable to cloud platforms. It operates as a local utility wrapper around reliable engines like `yt-dlp` and `FFmpeg`.

---

## 🎯 2. Product Vision
To provide a secure, fast, and unified web application that allows users to scrape, download, and transcode digital assets without any third-party telemetry, tracking, or cloud file leakages. 

Key success metrics:
*   **Privacy First**: No telemetry. File operations occur directly on user-controlled hardware or virtual private cloud instances.
*   **Resiliency**: Automated recovery and fallback mechanisms (e.g., ReportLab parsing PDF structure when MS Word COM bindings fail).
*   **Responsiveness**: Long-running media transcodes or network fetches do not block UI interactions.

---

## 🛠️ 3. Functional Requirements (FR)

### FR-1: Web Scraper & Asset Extractor
*   **FR-1.1**: The system must parse a target URL and locate all embedded media assets (`<img>`, `<video>`, `<audio>`, inline SVGs, and link favicon references).
*   **FR-1.2**: Scraped assets must be classified by type: `image`, `gif`, `svg`, `ico`, `video`, or `audio`.
*   **FR-1.3**: The system must query metadata (dimensions for images/gifs, file size in bytes) where available without fully downloading the asset to the client first.

### FR-2: Asynchronous Video & Audio Downloader
*   **FR-2.1**: The system must download video/audio from YouTube and other supported websites in the background using `yt-dlp`.
*   **FR-2.2**: The system must allow users to select target quality levels (e.g., 1080p, 720p, audio-only, or thumbnail-only).
*   **FR-2.3**: The downloader must support live action triggers: `pause`, `resume`, and `stop` (abort execution).
*   **FR-2.4**: The system must limit download speed based on settings presets (`low`, `medium`, `high`, `max`) or custom settings to prevent service blocking or network congestion.

### FR-3: Formatted File Converter
*   **FR-3.1**: The system must allow file uploads and transcode them locally on the server (no external conversion APIs).
*   **FR-3.2**: Image conversion must support JPG, PNG, WebP, BMP, GIF, ICO, and AVIF. Transparency must be flattened automatically when converting to formats that lack alpha-channels (e.g., JPG).
*   **FR-3.3**: Document conversion must support converting Word Documents (.docx) to PDF, and PDF documents to Word.
*   **FR-3.4**: When MS Word or system COM libraries are missing on the target host, document conversion must fall back to a Python-native parser and ReportLab builder to output PDF text layout dynamically.

### FR-4: Profile Settings Configuration
*   **FR-4.1**: Users must be able to adjust app configurations such as UI theme, max concurrent downloads, rate limits, and output folder locations.
*   **FR-4.2**: Settings must be persisted to a local JSON file (`user_settings.json`) and merge defaults automatically for missing parameters.

### FR-5: Lossless Media Compressor
*   **FR-5.1**: The system must support compressing images (JPG, PNG, WebP) and videos (MP4, MKV, AVI, MOV, WEBM) via a local Flask endpoint `/api/compress`.
*   **FR-5.2**: The system must allow users to choose between compression intensity levels: `low` (preserves visual fidelity), `medium` (balanced quality and size reduction), and `high` (maximum size reduction).
*   **FR-5.3**: For image compression, the system must apply format-specific optimizations:
    *   *JPG/WebP*: Apply custom quality factor constraints (85, 70, or 55) based on level.
    *   *PNG*: Apply color quantization (downsampling to 128 or 256 colors) or specify max compression level (compress_level=9).
*   **FR-5.4**: For video compression, the system must invoke FFmpeg and adjust the target Constant Rate Factor (CRF) and audio bitrate:
    *   *Standard container files (MP4, etc.)*: CRF 20 (low), 26 (medium), or 32 (high) using `libx264`.
    *   *WebM files*: CRF 24 (low), 30 (medium), or 36 (high) using `libvpx-vp9`.
    *   *Audio streams*: Cap audio bitrate at 128k (low/medium) or 96k (high).
*   **FR-5.5**: The system must track compression progress and expose it in real-time via `/api/compress/progress/<task_id>`.

---

## 🔒 4. Non-Functional Requirements (NFR)

### NFR-1: Performance & Concurrency
*   Network operations must run on detached daemon threads. The Flask server must limit active worker thread count based on the `max_concurrent_downloads` setting (default `3`).
*   Temp files must have a configurable Time-To-Live (TTL) (default `1 hour`). Background sweeps must automatically purge completed or aborted temporary artifacts to prevent server disk overflow.

### NFR-2: Security
*   All user-supplied URLs must be validated for scheme (`http://` or `https://`) and length capped at `4096` characters to prevent buffer overflow attacks.
*   Uploaded files must be sanitized using `secure_filename` to prevent path traversal vulnerabilities.
*   The Flask application must support CORS policy settings via `CORS_ORIGINS` to prevent unauthorized cross-site requests.

### NFR-3: Reliability & Graceful Fallbacks
*   If FFmpeg or ffprobe binaries are missing from the system path or environment variables, the system must disable media conversion and raise a descriptive error (`FFMPEG_MISSING`) rather than crashing.

---

## 🌐 5. Deployment Section

MediaRift is designed to be hosted remotely on cloud platforms. The primary deployment model is a **Unified Docker Container** hosted on **Render** (or Railway). This setup packages both the React static assets and the Flask Python backend inside a single running service, avoiding complex domain settings or CORS issues.

```mermaid
graph TB
    subgraph Browser ["User Client Environment"]
        UserBrowser["User Web Browser"]
    end

    subgraph RenderPlatform ["Render Cloud Platform"]
        subgraph DockerContainer ["Unified Docker Container"]
            ReactStatic["Vite React App (Static Files Served)"]
            FlaskBackend["Flask Backend Service (Gunicorn WSGI)"]
            
            ReactStatic -->|API Requests| FlaskBackend
        end
        
        PersistentDisk["Persistent Disk Storage (Mounted to /app/downloads)"]
        FlaskBackend -->|Saves Media & Reads Downloads| PersistentDisk
    end

    UserBrowser -->|HTTP GET (Loads Site)| ReactStatic
    UserBrowser -->|HTTP POST/GET (API Endpoint Requests)| FlaskBackend
```

### 5.1 Deployment Architecture
1.  **Container Base**: `python:3.11-slim` ensures a lightweight operating system footprint.
2.  **System Binaries**: The Docker container installs `ffmpeg` and `curl` via `apt-get` at build time. This ensures media merging, conversion, and compression functions work out-of-the-box in the cloud.
3.  **Client Hosting**: A multi-stage Docker build compiles the Vite frontend into static files (`frontend/dist`). The Flask application serves these static files directly from the root path (`/`).
4.  **Process Manager**: Gunicorn is used as a production-grade WSGI HTTP Server to manage Flask processes with multiple concurrent worker threads.

### 5.2 Required Cloud Services
To host the application independently, the following configurations are required:

*   **Hosting Service**: Render Web Service (Starter tier or higher, as FFmpeg media transcoding and compression is CPU and memory intensive).
*   **Memory Limit**: Minimum **512MB RAM** (1GB RAM recommended to ensure stable compression of large video/media files without triggering OOM events).
*   **Disk Storage**: Render containers have ephemeral disks. To prevent downloaded media files from being lost when the container restarts (e.g., during a deployment or daily maintenance), a **Persistent Disk** (1GB to 10GB) must be attached:
    *   **Mount Path**: `/app/downloads`
*   **Environment Configuration**: Env variables defined below must be configured in the Render Dashboard.

---

### 5.3 Steps to Deploy (Render Web Service)

Follow these instructions to deploy MediaRift to Render:

#### Step 1: Push Codebase to GitHub
Ensure the Dockerfile and source files are pushed to your remote repository:
```bash
git add .
git commit -m "feat: Add Dockerfile and deployment documentation"
git push origin main
```

#### Step 2: Create a New Web Service on Render
1. Log in to the [Render Dashboard](https://dashboard.render.com).
2. Click **New** -> **Web Service**.
3. Connect your GitHub repository containing the MediaRift files.

#### Step 3: Configure Build & Runtime Settings
Configure the following fields in the Render creation wizard:
*   **Name**: `mediarift` (or any custom name)
*   **Region**: Select the region closest to your target audience.
*   **Branch**: `main`
*   **Runtime**: `Docker` *(Render will automatically detect the root `Dockerfile`)*
*   **Plan**: `Starter` (or higher)

#### Step 4: Configure Environment Variables
Click **Advanced** and add the following Environment Variables:
*   `FLASK_ENV` = `production`
*   `FLASK_DEBUG` = `false`
*   `PORT` = `10000` *(Render exposes services on port 10000 by default; our Dockerfile handles this automatically)*
*   `SECRET_KEY` = `your-custom-production-crypto-key`
*   `CORS_ORIGINS` = `https://mediarift.onrender.com`
*   `MAX_DOWNLOAD_SIZE` = `2147483648` (2 GB soft cap)
*   `YTDLP_TIMEOUT` = `600`
*   `TEMP_FILE_TTL` = `1800` (30 minutes retention)

#### Step 5: Attach Persistent Disk (Recommended)
To enable persistent downloads across container restarts:
1. In the Web Service creation wizard (or later in the service **Disk** settings tab).
2. Click **Add Disk**.
3. Set **Name** to `mediarift-downloads`.
4. Set **Mount Path** to `/app/downloads`.
5. Set **Size** to `5 GiB` (or your preferred size).

#### Step 6: Trigger Initial Build
Click **Create Web Service**. Render will:
1. Pull the Dockerfile.
2. Spin up the Node.js builder stage to build the Vite frontend.
3. Construct the Python runtime stage, install FFmpeg, and install the backend pip packages.
4. Launch the application via `gunicorn`.

Once the deploy log shows `Listening at http://0.0.0.0:10000`, the application is live at `https://mediarift.onrender.com`.

---

### 5.4 Steps to Update the Application
1.  **Automatic CI/CD**: By default, Render listens for changes to the connected Git branch (`main`). Pushing code updates directly to GitHub will automatically trigger a new rolling Docker build.
2.  **Manual Deploy**: If you wish to trigger a rebuild without a code change:
    1. Navigate to the Render Dashboard.
    2. Select the `mediarift` Web Service.
    3. Click the **Manual Deploy** button.
    4. Select **Clear Build Cache & Deploy** to ensure all dependencies are fresh.

---

### 5.5 Steps to Roll Back a Deploy
If an update introduces a bug:
1. Go to the **Events** or **Deploys** tab of the service in Render.
2. Locate the last stable deployment.
3. Click the menu next to the build and select **Rollback**.
4. The running instance will instantly switch back to the prior stable container image while you fix the codebase.
