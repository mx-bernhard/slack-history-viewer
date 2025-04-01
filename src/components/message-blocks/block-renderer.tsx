import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEmoji } from '../../contexts/emoji-context';
import { useUsers } from '../../contexts/user-context';
import { useStore } from '../../store';
import {
  RichTextElement,
  SectionBlockType,
  SlackBlock,
  SlackUser,
} from '../../types';
import { getHighlighted } from '../get-highlighted';
import { isEmpty, thru } from 'lodash-es';

export const BlockRenderer = ({
  blocks,
  messageTs,
  messageInSearchResults,
}: {
  blocks: SlackBlock[];
  messageTs: string;
  messageInSearchResults: boolean;
}) => {
  if (blocks.length === 0) return null;

  return (
    <div className="blocks-container">
      {blocks.map((block, blockIndex) => (
        <BlockItem
          key={block.block_id != null ? blockIndex : ''}
          block={block}
          messageTs={messageTs}
          messageInSearchResults={messageInSearchResults}
        />
      ))}
    </div>
  );
};

// Renders an individual block based on its type
const BlockItem = ({
  block,
  messageTs,
  messageInSearchResults,
}: {
  block: SlackBlock;
  messageTs: string;
  messageInSearchResults: boolean;
}) => {
  switch (block.type) {
    case 'rich_text':
      return (
        <RichTextBlock
          elements={block.elements ?? []}
          messageTs={messageTs}
          messageInSearchResults={messageInSearchResults}
        />
      );
    case 'section':
      return <SectionBlock block={block as SectionBlockType} />;
    // Add other block type cases here as needed (e.g., 'divider', 'image', 'actions', 'context')
    default:
      // Keep the default for unhandled types
      return (
        <div className="unsupported-block">
          {block.type} block type not supported
        </div>
      );
  }
};

// Renders a rich text block containing multiple elements
const RichTextBlock = ({
  elements,
  messageTs,
  messageInSearchResults,
}: {
  elements: RichTextElement[];
  messageTs: string;
  messageInSearchResults: boolean;
}) => {
  return (
    <div className="rich-text-block">
      {elements.map((element, elementIndex) => (
        <ElementRenderer
          key={elementIndex}
          element={element}
          messageTs={messageTs}
          messageInSearchResults={messageInSearchResults}
        />
      ))}
    </div>
  );
};

// Renders an individual element based on its type
const ElementRenderer = ({
  element,
  messageTs,
  messageInSearchResults,
}: {
  element: RichTextElement;
  messageTs: string;
  messageInSearchResults: boolean;
}) => {
  switch (element.type) {
    case 'rich_text_section':
      return (
        <RichTextSection
          elements={element.elements ?? []}
          messageTs={messageTs}
          messageInSearchResults={messageInSearchResults}
        />
      );
    case 'rich_text_quote':
      return (
        <RichTextQuote
          elements={element.elements ?? []}
          messageTs={messageTs}
          messageInSearchResults={messageInSearchResults}
        />
      );
    default:
      return <div className="unsupported-element">{element.type}</div>;
  }
};

type GetUserByIdFn = (userId: string) => SlackUser | undefined;
// Re-add ParseEmojiFn type definition
type ParseEmojiFn = (text: string) => string;

const emptyStringArray: string[] = [];

// Renders individual text elements with proper formatting
const TextElement = ({
  element,
  getUserById,
  parseEmoji,
  messageTs,
  messageInSearchResults,
}: {
  element: RichTextElement;
  getUserById: GetUserByIdFn;
  parseEmoji: ParseEmojiFn;
  messageTs: string;
  messageInSearchResults: boolean;
}) => {
  const { highlightPhrases, isCurrentSearchResult } = useStore(
    ({
      currentResultIndex,
      searchResults,
      selectedChatId,
      actions: { isCurrentSearchResult },
    }) => {
      const highlightPhrases =
        messageInSearchResults &&
        currentResultIndex !== -1 &&
        searchResults != null &&
        searchResults instanceof Array
          ? (searchResults[currentResultIndex]?.highlightPhrases ??
            emptyStringArray)
          : emptyStringArray;
      const isCurrentSearchResultValue = isCurrentSearchResult(
        selectedChatId ?? '',
        messageTs
      );

      return {
        highlightPhrases,
        isCurrentSearchResult: isCurrentSearchResultValue,
        messageInSearchResults,
      };
    }
  );

  const { type } = element;

  switch (type) {
    case 'text': {
      const textContent = element.text ?? '';
      const maybeHighlightedText = getHighlighted(
        textContent,
        highlightPhrases,
        isCurrentSearchResult
      );
      if (element.style?.bold != null) {
        return <strong>{maybeHighlightedText}</strong>;
      }
      if (element.style?.italic != null) {
        return <em>{maybeHighlightedText}</em>;
      }
      if (element.style?.strike != null) {
        return <s>{maybeHighlightedText}</s>;
      }
      if (element.style?.code != null) {
        return <code>{maybeHighlightedText}</code>;
      }
      return <span>{maybeHighlightedText}</span>;
    }
    case 'link': {
      const url = element.url ?? '#';
      const linkText = thru(element.text?.trim(), text =>
        text == null || isEmpty(text) ? url : text
      );
      return (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {getHighlighted(linkText, highlightPhrases, isCurrentSearchResult)}
        </a>
      );
    }
    case 'emoji': {
      const name = element.name ?? '';
      if (!name) {
        return null; // Don't render anything if name is missing
      }
      // Construct the Slack-style code
      const emojiCode = `:${name}:`;
      // Call the parseEmoji function from the context
      const emojiHtml = parseEmoji(emojiCode);

      // Render the result (which is either an <img> tag or the original code)
      // using dangerouslySetInnerHTML
      return (
        <span
          className="emoji emoji-rendered" // Use a general class
          aria-label={name}
          dangerouslySetInnerHTML={{ __html: emojiHtml }}
        />
      );
    }

    case 'user': {
      const userId = element.user_id ?? '';
      const user = getUserById(userId);
      const displayName =
        user?.profile.display_name ??
        user?.name ??
        user?.profile.real_name ??
        userId;
      return <span className="mention">@{displayName || 'User'}</span>;
    }

    default:
      return (
        <span className="unsupported-text">
          {/* Fallback for unknown types */}
        </span>
      );
  }
};

const SectionBlock = ({
  block,
}: {
  block: SectionBlockType;
}): React.JSX.Element => {
  // Helper for rendering markdown safely
  const renderMarkdown = (
    text: string | undefined | null
  ): React.JSX.Element | null => {
    if (typeof text === 'string' && text.trim() !== '') {
      return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
    }
    return null;
  };
  // Helper for rendering plain text safely
  const renderPlainText = (
    text: string | undefined | null
  ): React.JSX.Element | null => {
    if (typeof text === 'string' && text.trim() !== '') {
      return <p>{text}</p>; // Render plain text in a paragraph
    }
    return null;
  };

  // Explicitly return the JSX structure
  return (
    <div className="section-block">
      {/* Render top-level text safely */}
      {block.text?.type === 'mrkdwn' && renderMarkdown(block.text.text)}
      {block.text?.type === 'plain_text' && renderPlainText(block.text.text)}

      {/* Render fields if they exist */}
      {block.fields && block.fields.length > 0 && (
        <div className="section-fields">
          {block.fields.map((field, index) => (
            <div key={index} className="section-field">
              {/* Render field text safely */}
              {field.type === 'mrkdwn' && renderMarkdown(field.text)}
              {
                field.type !== 'mrkdwn' &&
                  renderPlainText(field.text) /* Treat non-mrkdwn as plain */
              }
            </div>
          ))}
        </div>
      )}
      {/* TODO: Render accessory if needed */}
    </div>
  );
};

// --- RichTextSection & RichTextQuote ----
// Ensure these components pass the parseEmoji prop down
export const RichTextSection = ({
  elements,
  messageTs,
  messageInSearchResults,
}: {
  elements: RichTextElement[];
  messageTs: string;
  messageInSearchResults: boolean;
}) => {
  const { getUserById } = useUsers();
  const { parseEmoji } = useEmoji(); // Get parseEmoji from context

  return (
    <span className="rich-text-section">
      {elements.map((element, index) => (
        <TextElement
          key={index}
          element={element}
          getUserById={getUserById}
          parseEmoji={parseEmoji}
          messageTs={messageTs}
          messageInSearchResults={messageInSearchResults}
        />
      ))}
    </span>
  );
};

export const RichTextQuote = ({
  elements,
  messageTs,
  messageInSearchResults,
}: {
  elements: RichTextElement[];
  messageTs: string;
  messageInSearchResults: boolean;
}) => {
  const { getUserById } = useUsers();
  const { parseEmoji } = useEmoji(); // Get parseEmoji from context

  return (
    <blockquote className="rich-text-quote">
      <span className="rich-text-section">
        {elements.map((element, index) => (
          <TextElement
            key={index}
            element={element}
            getUserById={getUserById}
            parseEmoji={parseEmoji}
            messageTs={messageTs}
            messageInSearchResults={messageInSearchResults}
          />
        ))}
      </span>
    </blockquote>
  );
};
