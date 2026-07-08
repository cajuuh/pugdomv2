@AGENTS.md
content = """# Gemini AI Context - Expo Mastodon Client

This file serves as a contextual guide and prompt anchor for Gemini AI when assisting with the development of the Expo-based Mastodon application. It ensures the AI understands the project's tech stack, design architecture, and integration points.

---

## 🚀 Project Overview

This project is a cross-platform mobile application built using **Expo** and **React Native**. The core functionality of the app is to interface with the **Mastodon** decentralized social network, allowing users to log in via OAuth, view their timelines, post statuses, and interact with the Fediverse natively.

### Core Stack
- **Framework:** Expo (React Native)
- **Language:** TypeScript
- **State Management:** React Context / TanStack Query (for server state)
- **Styling:** Tailwind CSS (via NativeWind)

---

## 📚 Official Documentation & Sources

When generating code, debugging, or designing features, prioritize the official standards and implementations described in these references:

- 🐘 **Mastodon API Documentation:** [https://docs.joinmastodon.org/](https://docs.joinmastodon.org/)
- 🚀 **Expo Guides & Documentation:** [https://docs.expo.dev/guides/overview/](https://docs.expo.dev/guides/overview/)

---

## 🛠️ Key Architectural Instructions

### 1. Mastodon API & Authentication Flow
- **OAuth Registration:** The app must dynamically register an application on the user's specified Mastodon instance (`POST /api/v1/apps`) to obtain a `client_id` and `client_secret`.
- **User Authentication:** Use Expo's `WebBrowser` or `AuthSession` modules to handle the OAuth2 code exchange flow safely on mobile devices.
- **Token Storage:** Safely persist the user's access token and the instance URL using `expo-secure-store`. Never expose these in plain AsyncStorage.
- **API Versioning:** Default to the stable `/api/v1/` endpoints unless specified (e.g., streaming or specialized media filters available in `/api/v2/`).

### 2. Expo & Mobile Environment Guidelines
- **TypeScript Strictness:** Always enforce strict typing for API responses (e.g., typing Mastodon `Status`, `Account`, and `Context` objects accurately).
- **Asynchronous Safe Rendering:** Ensure list views utilize `FlashList` (from Shopify) or Expo-optimized `FlatList` to handle infinite scrolling timelines smoothly without memory leaks.
- **Image & Media Handling:** Use optimized image components to handle Mastodon's extensive image attachments, animated GIFs, and custom emojis seamlessly.

### 3. Feature Roadmap AI Directives
When asked to build features, implement them in alignment with these standard Mastodon paradigms:
- **Home Timeline:** Fetch via `GET /api/v1/timelines/home` supporting pagination using `max_id` and `since_id`.
- **Publishing Statuses:** Implement a character counter (500-character standard default) and support Content Warnings (CW) via `spoiler_text`.
- **Media Uploads:** Handle multi-part form uploads (`POST /api/v1/media`) before attaching the returned IDs to a new status.

### 4. User Settings
- Use `yarn` this project was wrote to work with yarn