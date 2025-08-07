import { isEmpty, thru } from 'lodash-es';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEmoji } from '../../contexts/emoji-context';
import { useUsers } from '../../contexts/user-context';
import { useStore } from '../../store';
import type {
  Block,
  RichTextBlock,
  RichTextBlockElement,
  RichTextElement,
  SectionBlock,
} from '@slack/web-api';
import { getHighlighted } from '../get-highlighted';
import { ReactElement, ReactNode } from 'react';
import { isNever } from 'typed-assert';

export const BlockRenderer = ({
  blocks,
  messageTs,
  messageInSearchResults,
}: {
  blocks: Block[];
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

const BlockItem = ({
  block,
  messageTs,
  messageInSearchResults,
}: {
  block: Block;
  messageTs: string;
  messageInSearchResults: boolean;
}) => {
  switch (block.type) {
    case 'rich_text':
      return (
        <div className="rich-text-block">
          <RichTextBlockRenderer
            elements={(block as RichTextBlock).elements}
            messageTs={messageTs}
            messageInSearchResults={messageInSearchResults}
          />
        </div>
      );
    case 'section':
      return <SectionBlockRenderer block={block as SectionBlock} />;
    default:
      return (
        <div className="unsupported-block">
          <span>{block.type} block type not supported</span>
        </div>
      );
  }
};

const RichTextBlockRenderer = ({
  elements,
  messageTs,
  messageInSearchResults,
}: {
  elements: RichTextBlockElement[];
  messageTs: string;
  messageInSearchResults: boolean;
}) => {
  return elements.map((element, elementIndex) => (
    <RichTextElementRenderer
      key={elementIndex}
      element={element}
      messageTs={messageTs}
      messageInSearchResults={messageInSearchResults}
    />
  ));
};

const RichTextElementRenderer = ({
  element,
  messageTs,
  messageInSearchResults,
}: {
  element: RichTextBlockElement;
  messageTs: string;
  messageInSearchResults: boolean;
}) => {
  if (element.type === 'rich_text_list') {
    return (
      <ul>
        {element.elements.map((e, i) => (
          <li key={i} style={{ listStyle: 'inside' }}>
            <RichTextElementRenderer
              element={e}
              messageInSearchResults={messageInSearchResults}
              messageTs={messageTs}
            />
          </li>
        ))}
      </ul>
    );
  }
  const elements = (
    <RichTextElementsRenderer
      elements={element.elements}
      messageTs={messageTs}
      messageInSearchResults={messageInSearchResults}
    />
  );
  switch (element.type) {
    case 'rich_text_section':
      return <span className="rich-text-section">{elements}</span>;
    case 'rich_text_quote':
      return (
        <blockquote className="rich-text-quote">
          <span className="rich-text-section">{elements}</span>
        </blockquote>
      );
    case 'rich_text_preformatted':
      return <pre>{elements}</pre>;
    default:
      isNever(element);
  }
};

const RichTextElementsRenderer = ({
  elements,
  messageTs,
  messageInSearchResults,
  wrapElement = ({ children }) => children,
}: {
  elements: RichTextElement[];
  messageTs: string;
  messageInSearchResults: boolean;
  wrapElement?: ({ children }: { children: ReactNode }) => ReactNode;
}) =>
  elements
    .map((element, index) => (
      <TextElement
        key={index}
        element={element}
        messageTs={messageTs}
        messageInSearchResults={messageInSearchResults}
      />
    ))
    .map(reactElement => wrapElement({ children: reactElement }));

const emptyStringArray: string[] = [];

const TextElement = ({
  element,
  messageTs,
  messageInSearchResults,
}: {
  element: RichTextElement;
  messageTs: string;
  messageInSearchResults: boolean;
}) => {
  const { getUserById } = useUsers();
  const { parseEmoji } = useEmoji();

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
      const textContent = element.text;
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
      const url = element.url;
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
      const name = element.name;
      if (!name) {
        return null;
      }
      const emojiCode = `:${name}:`;
      const emojiHtml = parseEmoji(emojiCode);

      return (
        <span
          className="emoji emoji-rendered"
          aria-label={name}
          dangerouslySetInnerHTML={{ __html: emojiHtml }}
        />
      );
    }

    case 'user': {
      const userId = element.user_id;
      const user = getUserById(userId);
      const displayName =
        user?.profile.display_name ??
        user?.name ??
        user?.profile.real_name ??
        userId;
      return <span className="mention">@{displayName || 'User'}</span>;
    }

    default:
      return <span className="unsupported-text">Unsupported type: {type}</span>;
  }
};

const SectionBlockRenderer = ({
  block,
}: {
  block: SectionBlock;
}): ReactElement => {
  const renderMarkdown = (
    text: string | undefined | null
  ): ReactElement | null => {
    if (typeof text === 'string' && text.trim() !== '') {
      return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
    }
    return null;
  };

  const renderPlainText = (
    text: string | undefined | null
  ): React.JSX.Element | null => {
    if (typeof text === 'string' && text.trim() !== '') {
      return <p>{text}</p>;
    }
    return null;
  };

  return (
    <div className="section-block">
      {block.text?.type === 'mrkdwn' && renderMarkdown(block.text.text)}
      {block.text?.type === 'plain_text' && renderPlainText(block.text.text)}

      {block.fields && block.fields.length > 0 && (
        <div className="section-fields">
          {block.fields.map((field, index) => (
            <div key={index} className="section-field">
              {field.type === 'mrkdwn' && renderMarkdown(field.text)}
              {field.type !== 'mrkdwn' && renderPlainText(field.text)}
            </div>
          ))}
        </div>
      )}
      {block.accessory != null && <div>Unsupported accessory</div>}
    </div>
  );
};
