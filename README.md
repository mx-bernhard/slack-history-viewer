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
- Indexed fields
  - chat_id_s: technical chat id
  - ts_dt: timestamp of message in iso 8601 format. This allows, e.g., [date range
    queries](https://solr.apache.org/guide/solr/latest/indexing-guide/date-formatting-math.html#date-math-syntax)
    to restrict search
  - thread_ts_dt: timestamp of thread starting message in iso 8601 format. This allows, e.g., [date
    range
    queries](https://solr.apache.org/guide/solr/latest/indexing-guide/date-formatting-math.html#date-math-syntax)
    to restrict search
  - text_txt_en: the actual text mesage
  - chat_type_s: type of chat ("channel", "dm", "group", "mpim" and maybe more)
  - channel_name_s: name of the chat or channel, depends on chat_type_s
  - user_name_s: user name of message author
  - user_display_name_s: display name of message author, value may not be available for all users as
    it is optional
  - user_real_name_s: real name of message author
  - message_index_l: zero-based position within the chat
  - thread_message_b: "true" if this is a message in a thread else "false"
  - file_path_s: file path within the data dir
  - url_ss: all urls mentioned in the message as a solr array field
  - ts_s: timestamp of message as string in epoch seconds including 6 decimal places
  - thread_ts_s: timestamp of thread starting message as string in epoch seconds including 6 decimal places

## Future Enhancements

While the viewer covers core functionality, potential future enhancements include:

- Custom Emoji Display: Support for rendering custom emojis included in the Slack export.
- Add more context types:
  - forwarded message with link that navigates to the message
  - ...
- when navigating through search result, move to message after measure infos are reported
- highlight the message itself, not just the search text. The search text is not always available
  but the message is.
- show tree structure by chat types
- combine multiple messages from the same user in one block instead of multiple blocks with meta infos for each.
- localize all texts
- search input history

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
   - Docker Compose (for managing the Solr service, the app or both)

2. **Place Slack Export Data:**
   - Download your Slack workspace export and unzip it.
   - Either:
     - Place the **contents** of the unzipped folder into a directory named `data` in the project root.
     - OR: Set the `SLACK_HISTORY_DATA_PATH` environment variable to the path of the unzipped export directory when running the development server (e.g., `SLACK_HISTORY_DATA_PATH=/path/to/your/export yarn dev`).

3. **Install Dependencies:**

   ```bash
   nvm use
   corepack enable
   yarn install
   ```

4. **Run Development Server:**

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

5. **Initial Search Indexing:**
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

### Schema reindex

When switching to a new version of this app and search doesn't work or causes reindexing issues, dump both volumes and restart the containers:

```sh
docker compose down --volume
docker compose up -d
```

Reindexing may take some time depending on your slack workspace.

## Update emojis

Regenerates emojis - needed when the package emoji-datasource-google is updated or emojis-raw.ts is changed.

```sh
node --experimental-strip-types ./scripts/generate-emoji-map.ts
```
