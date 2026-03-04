# InfoBlend – Smart Web Augmentation Extension

InfoBlend is a lightweight Chrome Extension built with Manifest V3 that enhances the browsing experience by adding contextual tools directly into webpages.

It allows users to quickly view definitions, generate page summaries, block ads, and auto-fill forms without leaving the current page.

All processing is performed client-side to prioritize privacy and performance.

## Features

📖 **Instant Definitions**  
Select any word on a webpage to instantly view its definition in a floating overlay using dictionary APIs.

📝 **Page Summarizer**  
Generate concise summaries of webpage content using client-side extractive text summarization.

🛡 **Built-in Ad Blocking**  
Blocks common ad and tracking domains using Chrome's declarativeNetRequest API.

⚡ **Smart Form Auto-fill**  
Automatically fills common form fields (name, email, phone) using locally stored user data.

🎨 **Overlay Interface**  
A modern floating panel with dark-mode support that displays summaries and definitions directly on the page.

## Tech Stack

- Chrome Extension Manifest V3
- JavaScript
- Chrome Extension APIs
- DOM Manipulation
- Extractive Text Summarization
- DeclarativeNetRequest (Ad Blocking)
- Chrome Storage API

## Architecture Overview

The extension is structured into several components:

**Background Service Worker**  
Handles background tasks such as:
- context menu actions
- definition API requests
- messaging between scripts

**Content Script**  
Injected into webpages to:
- detect selected text
- extract page content
- render overlay UI

**Popup Interface**  
Provides settings and quick actions including:
- enabling/disabling features
- triggering page summaries
- storing auto-fill data

## Project Structure

```
infoblend-extension/
│
├── manifest.json
├── background.js
├── contentScript.js
├── popup.html
├── popup.js
├── style.css
│
├── icons/
│
├── rules/
│   └── adblockRules.json
│
└── README.md
```

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/InfoBlend.git
```

2. Open Chrome and go to:
```
chrome://extensions
```

3. Enable Developer Mode

4. Click Load unpacked

5. Select the project folder.

The extension should now appear in your browser.

## Usage

### Get Word Definitions
- Select any word on a webpage.
- The extension will display a definition in an overlay.

### Summarize a Page
- Click the extension icon.
- Press Summarize Current Page.
- A summary will appear in a floating panel.

### Auto-Fill Forms
- Enter your details in the extension popup.
- Save your settings.
- The extension will automatically detect and fill supported fields.

## Privacy

InfoBlend processes all data locally in the browser.
- No tracking
- No external data storage
- No user data collection

## Future Improvements

- AI-powered summarization
- Better article extraction
- Custom ad-blocking rules
- Support for multiple languages
- Chrome Web Store release

## License

MIT License