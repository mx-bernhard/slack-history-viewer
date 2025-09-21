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
- Group chats by type using a tree viewer
- Remember closed/expanded state for tree nodes
- Browse channel list.
- Display user information (names, avatars).
- Render message formatting (bold, italics, code blocks, links).
- Display message threads.
- Show attachments (links, previews).
- Display uploaded files (image in new browser tab, download links).
- Display emoji reactions with user lists on hover.
- Full-text search across all messages.
- Show current search result item by highlighting the message and when possible highlight the words that were part of the search query
- Adjust limit for search
- Reduce list of chats on the left to the current search result
- Allow clicking through search results within one chat
- Go back to search result list via top toolbar button
- Clear search result by clicking on the slack logo
- Bookmarking of
  - search query
  - limit
  - current search result item
  - opened thread
  - current chat when not searching
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

## Future enhancements / fixes

- Custom Emoji Display: Support for rendering custom emojis included in the Slack export.
- Add more message block types:
  - forwarded message with link that navigates to the message
  - spoiler tags
  - channel links
  - action types (just show them since this is an archive viewer after all)
  - ...
- fix @channel-name visuals and
- localize all texts
- search input history (what you have typed into the search field before)
- improve bookmarks by adding human-readable labels along with the chat id
- allow bookmarking of scroll position

- index the shown user name instead of internal user name that was in the original json
- index texts from attachment previews and other substructures that are allowed in one message, offer both a combined and indvidiual fields for flexibility
- provide a better search experience:
  - show search results along actual message in a separate panel that can be toggled
  - offer various clickable search templates that are added to the search input so that learning the solr syntax is not required most of the time
  - use enter key to search again
- show the workspace with the permissions of another user
- allow multiple workspaces
- Add screenshots to this README.md with a fake workspace that documents all features much better
- Keyboard navigation (select search result item, navigate between search result items, focus search input)
- Filter chat list with a small search input at the top

## Configuration

The server reads the location of the Slack export data from the `SLACK_HISTORY_DATA_PATH` environment variable.

- **Default:** If `SLACK_HISTORY_DATA_PATH` is not set, the server expects the data to be in a directory named `data` relative to the project root (where `package.json` resides).
- **Environment Variable:** You can set `SLACK_HISTORY_DATA_PATH` to an absolute or relative path pointing to your unpacked Slack export directory.

## Archiving the slack workspace data

Retrieve your Slack workspace export using [slackdump](https://github.com/rusq/slackdump). It is mandatory that it is in the file based format **in the end**. This is achieved by e.g. first archiving it in the database format (mentioned on the resume link below) and converting it later into the file based format. Run the slackdump binary and it will start in menu mode. Register your workspace and supply your credentials and then use the archive option (go through the options what you want, when resuming you do not seem to be able to change them later). The archive option allows you to interrupt it and [resume](https://github.com/rusq/slackdump/blob/master/cmd/slackdump/internal/resume/assets/resume.md) it. Use the convert option (`slackdump convert <location-of-archive-directory> <location-of-export-directory>`) after you are done. You can convert in a second terminal window while your export is still running to test out things.

After converting, the root directory of the export must contain the following files (maybe not all of them depending on your workspace):

- users.json
- dms.json
- channels.json
- mpims.json
- groups.json

There should also be various directories in the root directory, each containing json files in the format YYYY-MM-DD (e.g. "2025-06-30.json")

Either:

- Set the `SLACK_HISTORY_DATA_PATH` environment variable to the path of the unzipped export directory when running the development server (e.g., `SLACK_HISTORY_DATA_PATH=/path/to/your/export`) by supplying that in a .env file the docker-compose.yml or supplying the .env file location with `--env-file <location-of-.env>`.
- OR: Place the contents of the aforementioned folder into a directory named `data` in the project root.

## Running the app

Ensure docker with compose is installed. Then:

```bash
docker compose up --build
```

This builds the application container (if needed) and starts both the application container and the Solr container as defined in `docker-compose.yml`. The `-d` runs them in the background.

Whenever you start the app, it automatically checks for new files and indexes those. It stores the already indexed file paths in a _processed_messages.db_. Indexing from start should only take a few minutes even for larger workspaces.

## Accessing the Application

The Slack Viewer should be accessible in your browser at `http://localhost:5173`. There is no real production mode and it does not support authentication.

## Stopping the application

Hit Ctrl+C in the terminal.

## Local Development

To run the Slack Export Viewer locally for development:

1. **Prerequisites:**
   - Node.js (22.x or higher, LTS version recommended)
   - Yarn via corepack / nvm (.nvmrc included)
   - Docker (for running the Solr search engine)
   - Docker Compose (for managing the Solr service, the app or both)

2. **Install Dependencies:**

   ```bash
   nvm use
   corepack enable
   yarn install
   ```

3. **Run Development Server:**

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

### Update emojis

Regenerates emojis - needed when the package emoji-datasource-google is updated or emojis-raw.ts is changed.

```sh
node --experimental-strip-types ./scripts/generate-emoji-map.ts
```

### Schema reindex

When switching to a new version of this app and search doesn't work or causes reindexing issues, dump both volumes and restart the containers:

```sh
docker compose down --volume
docker compose up -d
```
