import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Import the specific map from the raw file
// Adjust the name 'unicodeToSlack' if it's different in the actual file
import { slackToUnicodeMap } from './emojis-raw.js';

const slackToUnicodeWithoutVariations = slackToUnicodeMap.flatMap(
  ({ short_names, unified }) => {
    return short_names.map(shortName => {
      return [unified, shortName] as const;
    });
  }
);

export const slackToUnicode: Array<[string, string]> = [
  ...slackToUnicodeWithoutVariations.map(
    ([unified, short_name]) => [unified, `:${short_name}:`] as [string, string]
  ),
  ...slackToUnicodeMap.flatMap(({ skin_variations, short_names }) => {
    if (skin_variations == null) return [];
    return Object.entries(skin_variations).flatMap(
      ([outerSkinVariationKey, { unified }]: [string, { unified: string }]) => {
        return short_names.flatMap(shortName => {
          const skinNames = slackToUnicodeWithoutVariations
            .filter(
              ([skinVariationKey]) => skinVariationKey === outerSkinVariationKey
            )
            .map(([, skinName]) => skinName);
          const result = skinNames.map(
            skinName =>
              [unified, `:${shortName}::${skinName}:`] as [string, string]
          );
          return result;
        });
      }
    );
  }),
];

// Define the structure we expect in node_modules/emoji-datasource-google/emoji.json
// Based on https://github.com/iamcal/emoji-data
interface EmojiDataSourceEntry {
  short_name: string;
  unified: string; // Codepoint, e.g., 1F604
  non_qualified?: string | null; // e.g., 1F1E6-1F1E8
  image: string; // e.g., 1f604.png
  sheet_x: number;
  sheet_y: number;
  short_names: string[];
  text?: string | null;
  texts?: string[] | null;
  category: string;
  subcategory: string;
  sort_order: number;
  added_in: string;
  has_img_apple: boolean;
  has_img_google: boolean;
  has_img_twitter: boolean;
  has_img_facebook: boolean;
  skin_variations?: Record<string, EmojiDataSourceEntry>;
  obsoletes?: string;
  obsoleted_by?: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// --- Configuration ---
// RAW_MAP_PATH is no longer needed for import, but keep for reference?
// const RAW_MAP_PATH = path.join(projectRoot, 'src', 'components', 'emojis-raw.ts');
const EMOJI_DATASOURCE_PATH = path.join(
  projectRoot,
  'node_modules',
  'emoji-datasource-google',
  'emoji.json'
);
const OUTPUT_MAP_DIR = path.join(projectRoot, 'src', 'components');
const OUTPUT_MAP_FILENAME = 'emoji-map.ts'; // Output as TypeScript
const OUTPUT_MAP_PATH = path.join(OUTPUT_MAP_DIR, OUTPUT_MAP_FILENAME);
// --- End Configuration ---

async function generateMap() {
  console.log(
    `Loaded ${String(Object.keys(slackToUnicode).length)} entries from unicodeToSlack map.`
  );

  console.log(`Loading emoji datasource from: ${EMOJI_DATASOURCE_PATH}`);
  let emojiDataSource: EmojiDataSourceEntry[];
  try {
    const dataSourceContent = await fs.readFile(EMOJI_DATASOURCE_PATH, 'utf-8');
    emojiDataSource = JSON.parse(dataSourceContent) as EmojiDataSourceEntry[];
    console.log(
      `Loaded ${String(emojiDataSource.length)} entries from emoji datasource.`
    );
  } catch (error) {
    console.error(
      `Error loading emoji datasource ${EMOJI_DATASOURCE_PATH}:`,
      error
    );
    process.exit(1);
  }

  // Create a lookup map from the datasource based on the 'unified' key (codepoint)
  const dataSourceMap = new Map<string, string>();
  emojiDataSource.forEach(entry => {
    // Primary key is the 'unified' codepoint
    if (entry.has_img_google && entry.image) {
      dataSourceMap.set(entry.unified.toUpperCase(), entry.image);
      // Also add non_qualified if it exists
      if (entry.non_qualified != null) {
        dataSourceMap.set(entry.non_qualified.toUpperCase(), entry.image);
      }
    }
    Object.values(entry.skin_variations ?? {}).forEach(variation => {
      dataSourceMap.set(variation.unified.toUpperCase(), variation.image);
    });
  });
  console.log(
    `Created datasource lookup map with ${String(dataSourceMap.size)} unified/non-qualified keys.`
  );

  const finalEmojiMap: Record<string, string> = {};
  let processedCount = 0;
  let skippedCount = 0;

  console.log('Processing raw map and generating final map...');
  // Iterate through the imported rawMap (unicodeToSlack)
  for (const [rawKey, slackName] of slackToUnicode) {
    const unifiedKey = rawKey.toUpperCase();
    const image = dataSourceMap.get(unifiedKey);

    if (image != null) {
      const imagePath = `/assets/emojis/${image}`;
      // Check if slackName is valid (not null/undefined/empty)
      if (typeof slackName === 'string' && slackName.length > 0) {
        finalEmojiMap[slackName] = imagePath;
        processedCount++;
      } else {
        console.warn(
          `Skipping Key: ${rawKey}. Invalid Slack name found: ${slackName}`
        );
        skippedCount++;
      }
    } else {
      // Log the slackName from the map value here
      console.warn(
        `Skipping ${slackName || '(No Slack Name)'} (Key: ${rawKey}). No matching entry or Google image found in datasource.`
      );
      skippedCount++;
    }
  }
  console.log(
    `Processing complete. Mapped: ${String(processedCount)}, Skipped: ${String(skippedCount)}`
  );

  // Ensure output directory exists
  try {
    await fs.mkdir(OUTPUT_MAP_DIR, { recursive: true });
  } catch (error) {
    console.error(`Error creating output directory ${OUTPUT_MAP_DIR}:`, error);
    process.exit(1);
  }

  // Write the final map as a TypeScript module
  const tsContent = `// Generated by scripts/generate-emoji-map.js
// Maps Slack emoji names to their image paths within the emoji-datasource-google package.

export const emojiImageMap: { [key: string]: string } = ${JSON.stringify(
    finalEmojiMap,
    null,
    2
  )};
`;

  try {
    await fs.writeFile(OUTPUT_MAP_PATH, tsContent, 'utf-8');
    console.log(`Successfully wrote final emoji map to: ${OUTPUT_MAP_PATH}`);
  } catch (error) {
    console.error(`Error writing final map file ${OUTPUT_MAP_PATH}:`, error);
    process.exit(1);
  }
}

generateMap().catch((error: unknown) => {
  console.error('Unhandled error during emoji map generation:', error);
  process.exit(1);
});
