export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  profile: {
    display_name?: string;
    real_name?: string;
    image_72?: string;
  };
  is_bot?: boolean;
  deleted?: boolean;
  is_admin?: boolean;
  is_owner?: boolean;
  is_primary_owner?: boolean;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_mpim?: boolean;
  is_private?: boolean;
  is_archived?: boolean;
  members?: string[];
  user?: string;
}

export interface ChatInfo {
  id: string;
  name: string;
  technicalName: string | undefined;
  type: 'channel' | 'group' | 'dm' | 'mpim';
  isArchived: boolean;
  otherMemberIds?: string[];
}

export interface SlackMessage {
  type: string;
  subtype?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
  reply_users_count?: number;
  latest_reply?: string;
  reply_users?: string[];
  replies?: Array<{ user: string; ts: string }>;
  blocks?: SlackBlock[];
  files?: SlackFile[];
  reactions?: SlackReaction[];
  attachments?: SlackAttachment[];
}

export interface SlackReaction {
  name: string;
  users: string[];
  count: number;
}

export interface SlackProfile {
  real_name?: string;
  display_name?: string;
  name?: string;
  image_72?: string;
}

export interface SlackConversationalItemBase {
  id: string;
  name?: string;
  is_archived?: boolean;
}

export interface SlackGroup extends SlackConversationalItemBase {
  members?: string[];
}

export interface SlackDM extends SlackConversationalItemBase {
  members?: string[];
}

export interface SlackMPIM extends SlackConversationalItemBase {
  members?: string[];
}

export interface ChatInfo {
  id: string;
  name: string;
  technicalName: string | undefined;
  type: 'channel' | 'group' | 'dm' | 'mpim';
  isArchived: boolean;
  otherMemberIds?: string[];
}

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
  name?: string;
  user_id?: string;
  style?: RichTextStyle;
  elements?: RichTextElement[];

  [key: string]: unknown;
}

export interface SlackBlock {
  type: 'section' | 'rich_text';
  block_id?: string;
  elements?: RichTextElement[];

  text?: RichTextElement;
  fields?: RichTextElement[];
  accessory?: unknown;

  [key: string]: unknown;
}

export interface SectionBlockType extends SlackBlock {
  type: 'section';
  text?: SectionField;
  fields?: SectionField[];
  accessory?: unknown;
}

export interface SectionBlockType extends SlackBlock {
  type: 'section';
}

export interface SectionField extends RichTextElement {
  type: 'mrkdwn' | 'plain_text';
}

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
  ts?: string;
  mrkdwn_in?: string[];
  actions?: unknown[];
  filename?: string;
  size?: number;
  mimetype?: string;
  url?: string;
  metadata?: unknown;
}

export interface SlackReaction {
  name: string;
  users: string[];
  count: number;
}

export interface SlackReply {
  user: string;
  ts: string;
}

export interface SlackMessage {
  client_msg_id?: string;
  type: string;
  subtype?: string;
  text?: string;
  user?: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
  reply_users_count?: number;
  latest_reply?: string;
  reply_users?: string[];
  replies?: SlackReply[];
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
  user_profile?: SlackProfile;
}

export interface SearchResultDocument {
  id: string;
  chatId: string;
  ts: string;
  tsDt: string;
  messageIndex: number;
  threadTsDt: string | null;
  threadTs: string | null;
  userDisplayName: string | null;
  userName: string;
  userRealName: string;
  userId: string;
  text: string;
  highlightPhrases: string[];
}
