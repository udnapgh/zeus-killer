<p align="center">
 <img width="100px" src="https://github.com/udnapgh/zeus-killer/blob/main/assets/icon.ico" align="center" alt="Zeus Killer Apps" />
 <h2 align="center">Zeus Killer</h2>
 <p align="center">A desktop application for YouTube content creators to automatically detect and remove online gambling/betting spam comments from their YouTube videos.</p>

</p>

<p align="center">
  <img width="30%" src="https://drive.usercontent.google.com/download?id=12843WRujCCAD1hgF1jk3Eew42SgCkeXI" align="center" alt="Zeus Killer Apps" />
  <img width="30%" src="https://drive.usercontent.google.com/download?id=1ssbr3Cl2b2JE4xG1rDm4hhfO4ATCru5B" align="center" alt="Zeus Killer Apps" />
</p>

## Features

- 🔐 Secure authentication with YouTube API
- 🔍 Scan all comments across your entire channel
- 🎰 Specialized detection of online gambling and betting spam comments
- 🚫 Detect spam using customizable blocked words list focused on gambling terminology
- ⚡ Batch deletion of gambling spam comments
- 🧠 Smart detection of unicode manipulation and other spam techniques used by betting promoters
- 💻 Cross-platform desktop application (Windows, macOS, Linux)

## Description

Zeus Killer helps YouTube content creators maintain clean comment sections by automatically detecting and removing online gambling spam comments. The application connects to your YouTube account, scans comments across your videos, and identifies gambling-related spam based on configurable criteria. Currently, the application is specifically optimized for detecting and removing online betting and gambling promotional comments.

## Requirements

- A Google account with a YouTube channel
- Google API credentials with YouTube Data API v3 access
- Node.js and npm (for development)

## Setup

1. Clone this repository
2. Install dependencies with `npm install`
3. Create a Google API project and enable the YouTube Data API v3
4. Download your credentials JSON file from the Google Cloud Console
5. Run the application with `npm start`
6. Upload your credentials and authorize with your YouTube account
7. Enter your YouTube Channel ID and start scanning for spam

## Usage

1. **Authorize**: Connect the app to your YouTube account
2. **Set Channel ID**: Enter your YouTube Channel ID
3. **Scan Comments**: Analyze all comments across your videos
4. **Review**: See detected spam comments with details
5. **Banish Spam**: Remove all detected spam comments with one click

## Development

- `npm start` - Start the application
- `npm run build` - Build the application for distribution
- `npm run lint` - Run linting

## Future Plans

### Expanded Detection Capabilities

While currently focused on online gambling/betting comments, we plan to expand detection to other spam types.

### Deep Learning Integration (NLP)

We're planning to enhance Zeus Killer with advanced Natural Language Processing capabilities:

- 🤖 **AI-Powered Detection**: Implement machine learning models to identify gambling spam patterns beyond simple keyword matching
- 🔄 **Self-Learning System**: Create a system that improves detection accuracy based on user feedback
- 🌐 **Multilingual Support**: Extend gambling spam detection capabilities across multiple languages
- 📊 **Sentiment Analysis**: Detect disguised gambling promotions even when they don't contain obvious blocked words
- 👥 **Bot Account Detection**: Identify automated gambling spam accounts based on comment patterns
- 🧪 **Experimental Mode**: Test new ML-based detection algorithms alongside traditional methods
- 🔍 **Beyond Gambling**: Eventually expand to other spam categories beyond the current gambling focus

These improvements will significantly reduce false positives while catching sophisticated gambling spam that evades traditional detection methods.

## License

[MIT License](LICENSE)
