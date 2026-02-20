# Screen Share Test App

A premium, glassmorphism-themed React application designed to demonstrate and validate browser screen-sharing capabilities, media stream lifecycle management, and robust error handling.

## 🚀 Features

- **Premium UI/UX:** Dark-themed glassmorphism design with animated mesh backgrounds and smooth transitions.
- **Native Web API:** Built using the native `navigator.mediaDevices.getDisplayMedia` API.
- **Real-time Preview:** Live local video preview of the captured stream.
- **Metadata Extraction:** Displays real-time stream information (Display Type, Resolution, Frame Rate).
- **Lifecycle Detection:** Automatically detects when the stream ends (either via the browser UI or programmatic stop).
- **Robust Error Handling:** Specifically handles permission denials, picker cancellations, and browser incompatibilities.
- **Zero Leaks:** Guaranteed cleanup of media tracks on stop, retry, and component unmount.

## 📦 Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation
1. Clone the repository or extract the project files.
2. Navigate to the project directory:
   ```bash
   cd screen-sharing
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally
1. Start the development server:
   ```bash
   npm run dev
   ```
2. Open your browser and navigate to `http://localhost:5173`.

## 🛠 Technical Flow

### 1. Verification Phase
On the homepage, the app immediately checks for `getDisplayMedia` support in the `navigator.mediaDevices` object. If unsupported (e.g., in a mobile browser), it displays an "Unsupported Browser" view.

### 2. Request Phase
When "Start Screen Test" is clicked, the `startScreenShare` function in our custom `useScreenShare` hook is invoked. It sets the status to `requesting` and triggers the browser's screen picker.

### 3. Capture Phase
Upon permission grant:
- The `MediaStream` is captured.
- Metadata is extracted from `videoTrack.getSettings()`.
- The stream is stored in a `ref` for lifecycle management and a `state` for UI rendering.

### 4. Lifecycle & Cleanup
- **onended listener:** Attached to the video track to detect when the user clicks the browser's "Stop Sharing" button.
- **Manual Stop:** Programmatically stops all tracks and resets the UI state.
- **Unmount:** A cleanup function ensures no media tracks continue to run if the user navigates away or closes the tab.

## 📱 Screenshots

![Home Page](file:///e:/Screen%20Sharing%20Task%20for%20BANAO%20TECH/screen-sharing/docs/screenshots/home.png)
*Homepage with animated background and feature overview*

![Screen Test Active](file:///e:/Screen%20Sharing%20Task%20for%20BANAO%20TECH/screen-sharing/docs/screenshots/test_active.png)
*Active screen share with live metadata and preview*

## 🌐 Browser Quirks & Limitations

- **Display Type:** While Chrome and Edge correctly identify `displaySurface` (tab, window, screen), Firefox may return `Unknown` as it does not always expose this metadata through `getSettings()`.
- **Frame Rate:** Some browsers may return a variable frame rate or omit it entirely depending on the capture source (e.g., sharing a static window).
- **Resolution:** Certain OS-level privacy settings (especially on macOS) might restrict the available resolutions.
- **Secure Context:** Screen sharing requires a Secure Context (HTTPS or localhost). It will fail on non-secure HTTP origins.
- **Mobile Support:** Most mobile browsers do not support `getDisplayMedia` for privacy and hardware reasons.

## 📜 License
This project is for demonstration and evaluation purposes.
