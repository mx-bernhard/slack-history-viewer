// Basic types for Slack entities based on export format

export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  profile: {
    display_name?: string;
    real_name?: string;
    image_72?: string;
    // Add other potential profile image sizes if needed
    // image_24?: string;
    // image_32?: string;
    // image_48?: string;
    // image_192?: string;
    // image_512?: string;
  };
  is_bot?: boolean;
  deleted?: boolean;
  is_admin?: boolean; // Added based on user data snippet
  is_owner?: boolean; // Added based on user data snippet
  is_primary_owner?: boolean; // Add this field
}

export interface SlackChannel {
  id: string;
  name: string;
  is_channel?: boolean; // Public channel
  is_group?: boolean; // Private channel
  is_im?: boolean; // Direct message
  is_mpim?: boolean; // Multi-person direct message
  is_private?: boolean; // Indicates if a channel/group is private
  is_archived?: boolean;
  members?: string[]; // List of user IDs
  user?: string; // For DMs, the user ID of the other person
}

// A more specific type combining info for display
export interface ChatInfo {
  id: string;
  name: string;
  technicalName: string | undefined;
  type: 'channel' | 'group' | 'dm' | 'mpim';
  isArchived: boolean;
  otherMemberIds?: string[]; // Add optional array for other member IDs (for avatar lookup)
  // Add other relevant info later if needed
}

export interface SlackMessage {
  type: string;
  subtype?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts: string; // Timestamp, often used as unique ID within a day
  thread_ts?: string; // Timestamp of the parent message in a thread
  reply_count?: number; // Number of replies in a thread
  reply_users_count?: number; // Number of users who replied in a thread
  latest_reply?: string; // Timestamp of the latest reply
  reply_users?: string[]; // Array of user IDs who have replied to the thread
  replies?: Array<{ user: string; ts: string }>; // Array of references to reply messages
  blocks?: SlackBlock[]; // Use the basic Block type
  files?: SlackFile[];
  reactions?: SlackReaction[];
  attachments?: SlackAttachment[]; // Add attachments
  // Add other fields as needed
}

export interface SlackReaction {
  name: string;
  users: string[];
  count: number;
}

// Define interfaces for Slack data structures
// (Add other interfaces as needed)

export interface SlackProfile {
  real_name?: string;
  display_name?: string;
  name?: string;
  image_72?: string;
  // Add other profile fields if used
}

// Common properties for conversational items
export interface SlackConversationalItemBase {
  id: string;
  name?: string;
  is_archived?: boolean;
  // Add other common fields if needed
}

// disabled for now
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SlackChannel extends SlackConversationalItemBase {
  // Channel specific fields (e.g., topic, purpose)
}

// Assuming structure for Groups, DMs, MPIMs - Adjust if needed
export interface SlackGroup extends SlackConversationalItemBase {
  members?: string[];
}

export interface SlackDM extends SlackConversationalItemBase {
  members?: string[];
}

export interface SlackMPIM extends SlackConversationalItemBase {
  members?: string[];
}

// Type for ChatInfo used in the UI
export interface ChatInfo {
  id: string;
  name: string;
  technicalName: string | undefined;
  type: 'channel' | 'group' | 'dm' | 'mpim';
  isArchived: boolean;
  otherMemberIds?: string[];
}

// Rich Text Block Elements (Crucial for rendering)
export interface RichTextStyle {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
}

export interface RichTextElement {
  type: string;
  text?: string;
  url?: string;
  name?: string; // Used for emoji type
  user_id?: string; // Used for user type
  style?: RichTextStyle;
  elements?: RichTextElement[]; // For nested structures like rich_text_section
  // Allow other unknown properties Slack might add
  [key: string]: unknown;
}

// Basic representation of a Slack Block Kit element
// See: https://api.slack.com/reference/block-kit/blocks
// Structure for top-level blocks in messages
export interface SlackBlock {
  type: 'section' | 'rich_text';
  block_id?: string;
  elements?: RichTextElement[]; // Used in rich_text blocks
  // Add other block-specific properties based on type
  text?: RichTextElement; // Used in section blocks (can be mrkdwn or plain_text)
  fields?: RichTextElement[]; // Used in section blocks
  accessory?: unknown;
  // Allow other unknown properties
  [key: string]: unknown;
}

// Define a placeholder type for accessories or use unknown
// Removed empty interface, use unknown instead
// interface AccessoryElement {}

// Define type for Section Block itself
export interface SectionBlockType extends SlackBlock {
  type: 'section';
  text?: SectionField;
  fields?: SectionField[];
  accessory?: unknown; // Use unknown for accessories
}

// More specific type for Section blocks (if needed, enhances SlackBlock)
export interface SectionBlockType extends SlackBlock {
  type: 'section';
  // text and fields are already in SlackBlock if typed correctly
}

// More specific type for Section fields (if needed, enhances RichTextElement)
// Note: Slack often uses 'text' within 'fields', which itself has a type.
// Reusing RichTextElement might be sufficient if its 'type' is checked (mrkdwn/plain_text)
export interface SectionField extends RichTextElement {
  type: 'mrkdwn' | 'plain_text';
}

// Slack File object structure
export interface SlackFile {
  id: string;
  created?: number;
  timestamp?: number;
  name?: string;
  title?: string;
  mimetype?: string;
  filetype?: string;
  pretty_type?: string;
  user?: string;
  editable?: boolean;
  size?: number;
  mode?: string;
  is_external?: boolean;
  external_type?: string;
  is_public?: boolean;
  public_url_shared?: boolean;
  display_as_bot?: boolean;
  username?: string;
  url_private?: string;
  url_private_download?: string;
  thumb_64?: string;
  thumb_80?: string;
  thumb_360?: string;
  thumb_360_w?: number;
  thumb_360_h?: number;
  thumb_480?: string;
  thumb_480_w?: number;
  thumb_480_h?: number;
  thumb_160?: string;
  thumb_720?: string;
  thumb_720_w?: number;
  thumb_720_h?: number;
  thumb_800?: string;
  thumb_800_w?: number;
  thumb_800_h?: number;
  thumb_960?: string;
  thumb_960_w?: number;
  thumb_960_h?: number;
  thumb_1024?: string;
  thumb_1024_w?: number;
  thumb_1024_h?: number;
  image_exif_rotation?: number;
  original_w?: number;
  original_h?: number;
  thumb_tiny?: string;
  permalink?: string;
  permalink_public?: string;
  is_starred?: boolean;
  shares?: unknown;
  channels?: string[];
  groups?: string[];
  ims?: string[];
  has_rich_preview?: boolean;
}

// Structure for attachments (legacy)
export interface SlackAttachment {
  msg_subtype?: string;
  fallback?: string;
  callback_id?: string;
  color?: string;
  pretext?: string;
  blocks?: SlackBlock[];
  service_url?: string;
  service_name?: string;
  service_icon?: string;
  author_id?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  from_url?: string;
  original_url?: string;
  author_subname?: string;
  channel_id?: string;
  channel_name?: string;
  id?: number;
  bot_id?: string;
  is_msg_unfurl?: boolean;
  is_reply_unfurl?: boolean;
  is_thread_root_unfurl?: boolean;
  is_app_unfurl?: boolean;
  app_unfurl_url?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short: boolean;
  }>;
  image_url?: string;
  image_width?: number;
  image_height?: number;
  image_bytes?: number;
  thumb_url?: string;
  thumb_width?: number;
  thumb_height?: number;
  video_html?: string;
  video_html_width?: number;
  video_html_height?: number;
  footer?: string;
  footer_icon?: string;
  ts?: string; // Can be string or number
  mrkdwn_in?: string[];
  actions?: unknown[]; // Define actions more specifically if needed
  filename?: string;
  size?: number;
  mimetype?: string;
  url?: string;
  metadata?: unknown;
}

// Structure for Reactions
export interface SlackReaction {
  name: string;
  users: string[];
  count: number;
}

// Structure for individual message replies (simplified)
export interface SlackReply {
  user: string;
  ts: string;
}

// Main Slack Message structure
export interface SlackMessage {
  client_msg_id?: string;
  type: string;
  subtype?: string; // Important for differentiating message types
  text?: string;
  user?: string;
  ts: string;
  thread_ts?: string; // Indicates message is part of a thread
  reply_count?: number;
  reply_users_count?: number;
  latest_reply?: string;
  reply_users?: string[];
  replies?: SlackReply[]; // Array of actual replies (newer format)
  subscribed?: boolean;
  last_read?: string;
  team?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  files?: SlackFile[];
  reactions?: SlackReaction[];
  edited?: {
    user: string;
    ts: string;
  };
  user_profile?: SlackProfile; // Sometimes included directly
  // Allow other unknown properties
  [key: string]: unknown;
}

// Type for search results
export interface SearchResultDocument {
  id: string; // Unique ID for the result (e.g., chatid_timestamp)
  chatId: string;
  ts: string;
  text: string;
  user: string;
  // Add score or other relevance info if provided by search backend
}
