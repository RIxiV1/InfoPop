infoblend/InfoPop: A Web Augmentation Toolkit

InfoPop is a powerful Chrome extension designed to make browsing smarter and reduce repetitive clicking. It started as a simple dictionary popup and has evolved into a full web augmentation tool, allowing you to modify and interact with webpages in new ways.

Select any word or sentence on a page to get an instant definition, or use the control panel to block distractions, auto-fill forms, and add custom buttons to your most-visited sites.

Core Features

1. Smart Definition Popup

The core of infopop is the on-select popup, which has two modes:

Free Dictionary Mode: By default, selecting a common word will show a quick, simple definition.

AI Explainer Mode: By adding your own API key (e.g., for Google's Gemini or WordsAPI), the popup becomes a powerful AI assistant. It can:

Define proper nouns (like "Gayhurst" or "Digby's") that dictionaries miss.

Explain entire sentences in a single, simple line.

Use a "smart prompt" to automatically know whether to "define" a single word or "explain" a sentence.

2. Web Augmentation Tools

infopop adds a powerful control panel to your browser, allowing you to customize any website on the fly. All settings are saved per-site.

Distraction Hider: Click "Select Element to Hide" to enter selection mode. Any element you click (like a sidebar, ad, or "related posts" box) will be hidden. The extension generates a robust selector to ensure it only hides what you clicked.

Auto-fill Profiles: Save common form information (name, email, phone) into profiles. When you're on a contact or checkout page, just click "Apply" to fill the form instantly.

Highlight Rules: Create rules to highlight important elements on a page. For example, add a rule for button.cta with a yellow color to make all primary "Call to Action" buttons stand out.

Quick Access Buttons: Add a custom button bar to any website. You can create buttons that:

Navigate to a specific URL (e.g., a "Dashboard" button on a homepage).

Click a specific element (e.g., an "Open Menu" button).

Configuration

All features are managed from the extension's popup icon in your Chrome toolbar.

Setting up the Custom API

To unlock the AI features, you need to configure a custom API:

Click the extension icon to open the Control Panel.

Set API Provider to Custom API Template.

Fill in the three fields (example for Google Gemini):

API Template: https://generativela...models/gemini-pro:generateContent

API Key: Your AIza... key from Google AI Studio.

API Key Header: x-goog-api-key

Click the "Test Endpoint" button to verify your key and URL are working.

All API keys are stored securely and locally using chrome.storage.local and are never synced.
