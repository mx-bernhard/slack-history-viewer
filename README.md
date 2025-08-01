# Slack Export Viewer

This project is a web-based viewer for Slack export archives, built with React, TypeScript, Vite,
Express and Solr licensed under the MIT license.

It allows you to browse your exported Slack data locally without needing an internet connection or
access to Slack itself.

## 🧑‍⚖️ License

This project is released under the [MIT License](LICENSE).

You can use it, modify it, distribute it – even for commercial purposes – without restriction. Just
keep the copyright notice.

See the full license text in the `LICENSE` file.

## Features

- View messages from public channels, private channels, direct messages (DMs), and multi-person DMs
  (MPIMs).
- Browse channel list.
- Display user information (names, avatars).
- Render message formatting (bold, italics, code blocks, links).
- Display message threads.
- Show attachments (links, previews).
- Display uploaded files (image previews, download links).
- Display emoji reactions with user lists on hover.
- Full-text search across all messages.
- Efficient loading and display using virtual scrolling (`react-window`).
- Server-Side Rendering (SSR) for initial load performance.
- Indexed fields
  - chat_id_s: technical chat id
  - ts_l: timestamp as epoch number in ms
  - ts_dt: timestamp of message, use, e.g., [date range queries](https://solr.apache.org/guide/solr/latest/indexing-guide/date-formatting-math.html#date-math-syntax) to restrict search
  - text_txt_en: the actual text mesage
  - chat_type_s: type of chat ("channel", "dm", "group", "mpim" and maybe more)
  - channel_name_s: name of the chat or channel, depends on chat_type_s
  - user_name_s: user name of message author
  - user_display_name_s: display name of message author
  - user_real_name_s: real name of message author

## Future Enhancements

While the viewer covers core functionality, potential future enhancements include:

- User & Channel Mentions: Highlighting and potentially linking `@user` and `#channel` mentions within messages.
- Advanced Search Filters: Adding options to filter search results by user, date range, or specific channels.
- Enhanced Message Subtype Handling: Better rendering for various message types (file comments, reminders, rich_text_list, etc.).
- Custom Emoji Display: Support for rendering custom emojis included in the Slack export.
- Pinned Messages: Ability to view or filter messages that were pinned in Slack.

## Project Structure

- `data/`: Place your unpacked Slack export data from the result of exporting (not archiving) via
  slackdump (JSON files per channel/DM, user data, channel data, attachments).
- `src/`: Frontend React application code (components, hooks, types, etc.).
- `public/`: Static assets served directly.
- `server.tsx`: Express server handling API requests, SSR, and static file serving.
- `vite.config.ts`: Vite configuration.
- `tsconfig.json`: TypeScript configuration.
- `package.json`: Project dependencies and scripts.

## Configuration

The server reads the location of the Slack export data from the `SLACK_HISTORY_DATA_PATH` environment variable.

- **Default:** If `SLACK_HISTORY_DATA_PATH` is not set, the server expects the data to be in a directory named `data` relative to the project root (where `package.json` resides).
- **Environment Variable:** You can set `SLACK_HISTORY_DATA_PATH` to an absolute or relative path pointing to your unpacked Slack export directory.

## Local Development

To run the Slack Export Viewer locally for development:

1. **Prerequisites:**
   - Node.js (22.x or higher, LTS version recommended)
   - Yarn via corepack / nvm (.nvmrc included)
   - Docker (for running the Solr search engine)
   - Docker Compose (for managing the Solr service)

2. **Clone the repository:**

   ```bash
   git clone <your-repo-url>
   cd <repository-directory>
   ```

3. **Place Slack Export Data:**
   - Download your Slack workspace export and unzip it.
   - Either:
     - Place the **contents** of the unzipped folder into a directory named `data` in the project root.
     - OR: Set the `SLACK_HISTORY_DATA_PATH` environment variable to the path of the unzipped export directory when running the development server (e.g., `SLACK_HISTORY_DATA_PATH=/path/to/your/export yarn dev`).

4. **Install Dependencies:**

   ```bash
   nvm use
   corepack enable
   yarn install
   ```

5. **Run Development Server:**

   There are two main ways to run during development:

   **Option 1: Local Node.js App + Dockerized Solr (Recommended for Dev)**

   a. **Start the Solr Service:**
   In your terminal, navigate to the project root and run:

   ```bash
   docker compose up solr -d
   ```

   This command starts only the Solr search engine container in the background, using the configuration in `docker-compose.yml`. It will also create a `solr_data` volume to persist the search index.

   b. **Run the Node.js Development Server:**
   In a separate terminal window (or the same one), run:

   ```bash
   yarn dev
   ```

   This starts the Vite/Express server locally. It will automatically attempt to connect to Solr at `http://localhost:8983` (the default).

   **Option 2: Fully Dockerized Setup**

   a. **Build and Start All Services:**

   ```bash
   docker compose up --build -d
   ```

   This builds the application container (if needed) and starts both the application container and the Solr container as defined in `docker-compose.yml`. The `-d` runs them in the background.

   **Accessing the Application:**

   In either setup, the Slack Viewer should be accessible in your browser at `http://localhost:5173`.

6. **Initial Search Indexing:**
   - When you start the application server for the first time (either locally via `yarn dev` or in Docker), it will automatically begin building the Solr search index from your Slack data.
   - **This initial indexing process can take a significant amount of time**, depending on the size of your Slack export. Monitor the server logs for progress.
   - Subsequent server starts will be much faster, as the system uses a local SQLite database (`processed_messages.db` created in the project root) to track already indexed messages and will only index new ones.

## Building for Production

To create an optimized production build:

1. **Run the Build Command:**

   ```bash
   yarn build
   ```

   This command compiles the TypeScript code, bundles the frontend application using Vite, and prepares the server code.

2. **Output:**
   The production-ready files will be generated in the `dist/` directory. This typically includes:
   - `dist/client/`: Optimized frontend assets (JS, CSS).
   - `dist/server/`: Transpiled server code.

3. **Running the Production Build:**
   - Ensure the Node.js environment has access to the directory containing your Slack export data.
   - Set the `SLACK_HISTORY_DATA_PATH` environment variable to the path of your Slack export directory.
   - Run the server:

   ```bash
   export SLACK_HISTORY_DATA_PATH=/path/to/your/export # Example for Linux/macOS
   # set SLACK_HISTORY_DATA_PATH=C:\path\to\your\export # Example for Windows CMD (untested)
   # $env:SLACK_HISTORY_DATA_PATH = "C:\path\to\your\export" # Example for Windows PowerShell

   NODE_ENV=production node dist/server.js
   ```

## Docker Deployment

The project includes a `Dockerfile` and `docker-compose.yml` for containerized deployment. This is the recommended way to run the application in a stable environment.

- **Services:** The `docker-compose.yml` defines two services:
  - `app`: Runs the Node.js/Express/React application.
  - `solr`: Runs the Apache Solr 9 search engine.
- **Data Mounting:** It mounts a local `./data` directory (relative to `docker-compose.yml`) into the `app` container at `/app/data`.
- **Environment Variable:** It sets `SLACK_HISTORY_DATA_PATH=/app/data` inside the `app` container.
- **Solr Index Persistence:** It uses a named Docker volume (`solr_data`) to persist the Solr search index across container restarts.
- **Usage:**
  1. Place your unpacked Slack export data into a directory named `data` in the project root (next to `docker-compose.yml`).
  2. Run `docker compose up --build -d`. The `--build` flag ensures the app image is up-to-date, and `-d` runs the services in the background.
  3. Access the viewer at `http://localhost:5173`.
  4. **Initial Indexing:** As with development, the first time the `app` container starts, it will begin indexing data into Solr. This might take a long time. Subsequent starts will use the SQLite tracking database (`processed_messages.db`, which will be created inside the `/app` directory within the container if running fully dockerized) to only index new data.

## Update emojis

Regenerates emojis - needed when the package emoji-datasource-google is updated or emojis-raw.ts is changed.

```sh
node --experimental-strip-types ./scripts/generate-emoji-map.ts
```
