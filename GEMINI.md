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
- This projects uses [gitmoji-cli](https://github.com/carloscuesta/gitmoji-cli), the commit command is `gitmoji -c` the user is prompted to select what kind of commit it is and after select it, the title and the message of the commit

---

# Pugdom: Mobile Client Design Specification

Here is the comprehensive technical design document for **Pugdom**, a modern mobile Mastodon client. This document translates the visual language and user flows from your reference materials into a clean, implementable spec sheet.

---

## 1. Design Philosophy & System Core

Pugdom combines the decentralized power of Mastodon with an ultra-modern, highly fluid interface. The visual identity relies heavily on **Glassmorphism**, depth layering, bold micro-interactions, and clear content containerization.

### Color Archetypes

* **Light Mode (Pristine):** High-translucency pure white surfaces over soft, colorful ambient background gradients (pinks, blues, and teals).
* **Dark Mode (Obsidian):** Deep charcoal tones (`#121318`) with emerald/lime green or neon cyan accent highlights to make key interactions pop.

---

## 2. Navigation Architecture (Floating Dock Component)

The navigation bar is the focal anchor of the application, utilizing a floating pill/dock layout isolated from the screen edges instead of a traditional bottom tab bar.

```
       [ Home ]   [ Search ]   (  +  )   [ Notifications ]   [ Profile ]
     └───────────────────────────▲─────────────────────────────────────┘
                          Central Action Anchor
```

### Visual Specifications

* **Geometry:** High border-radius (fully rounded pill shape) with distinct padding separating it from the screen edges.
* **Material:** Background blur layer (`backdrop-filter: blur(20px)`) coupled with a thin, low-opacity white border overlay to mimic physical glass.
* **The Centerpiece (Compose Trigger):**
* A perfectly circular floating button containing a crisp plus (`+`) or action icon.
* The center button sits nested inside a subtle geometric dip or protrudes slightly over the dock boundary.
* **Micro-interaction:** Tapping the center action expands a circular sub-dock or floating ring revealing direct quick-actions (e.g., Quick Post, Post Media, Audio Status).

---

## 3. Timeline & Feed Spec (Card Architecture)

The timeline prioritizes readability, high-fidelity media presentation, and instant context recognition.

### Header Element: Active Peer Rings

* Positioned directly at the top of the main timeline feed.
* A horizontally scrollable row of high-resolution avatar circles representing active users, instances, or pinned hashtags.
* Outlined with gradient status rings indicating unread content or live updates.

### Post Container Design

* **Card Isolation:** Every status (toot) is housed within an independent card container featuring smooth, rounded corners (`border-radius: 16px` to `24px`).
* **Grid-Based Media Layouts:**
* Single images adapt fluidly to aspect ratios with high-quality cropping.
* Multiple image attachments break into asymmetric mosaic grids (e.g., side-by-side or square quadrants) with tight, unified spacing.

* **Meta Content Placement:**
* User identification data (Avatar, Display Name, Instance Handle) cleanly separated at the top.
* Clear timestamp and privacy scope indicators (Public, Unlisted, Followers Only).

### Footer Interaction Layer

* Minimalist iconography for core Mastodon interactions: **Reply**, **Boost**, **Favorite**, and **Bookmark**.
* Inline counters displaying dynamic engagement counts (e.g., "120+ Likes", "65 Comments") placed adjacent to the icons.

---

## 4. Interaction Flows & Screen States

### A. Discover / Explore State

* Clean category badges or segmented control pills nested under the main search input field (e.g., "For You", "Following", "Local", "Federated").
* Asymmetric multi-column masonry grids for browsing discovery media tags.

### B. Rich Profile View

* **Hero Section:** A full-bleed profile banner fading smoothly into the card surface below.
* **Stat Trays:** Horizontal analytical panels displaying structural counts (Followers, Following, Total Posts) using clean dividing lines.
* **Categorized Content Tabs:** Clean toggle buttons separating regular Posts, Media attachments, and Public Replies.
"""