import { FC, useCallback, useEffect, useRef } from 'react';
import { SlackAttachment } from '../../types';
import { BlockRenderer } from '../message-blocks/block-renderer';

interface AttachmentRendererProps {
  attachments: SlackAttachment[];
  onImageLoad?: (height: number, imageUrl: string) => void;
  messageTs: string;
}

/**
 * Renders a list of message attachments
 */
export const AttachmentRenderer: FC<AttachmentRendererProps> = ({
  attachments,
  onImageLoad,
  messageTs,
}) => {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="attachment-container">
      {attachments.map((attachment, index) => (
        <AttachmentItem
          key={index}
          attachment={attachment}
          onImageLoad={onImageLoad}
          messageTs={messageTs}
        />
      ))}
    </div>
  );
};

interface AttachmentItemProps {
  attachment: SlackAttachment;
  onImageLoad?: (height: number, imageUrl: string) => void;
  messageTs: string;
}

/**
 * Renders a single attachment
 */
const AttachmentItem: FC<AttachmentItemProps> = ({
  attachment,
  onImageLoad,
  messageTs,
}) => {
  const {
    title,
    title_link,
    text,
    image_url,
    thumb_url,
    service_name,
    service_icon,
    author_name,
    author_link,
    author_icon,
    color,
    fields,
    blocks,
  } = attachment;

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine if this is a service unfurl (like YouTube)
  const isServiceUnfurl = service_name != null;

  // For YouTube unfurls, use the thumbnail as the main image if no image_url is provided
  const displayImageUrl = image_url ?? (isServiceUnfurl ? thumb_url : null);
  const shouldShowThumbnail =
    !(thumb_url == null) && displayImageUrl == null && !isServiceUnfurl;

  // Determine if the attachment has blocks
  const hasBlocks = blocks != null && blocks.length > 0;

  // Handle image load to adjust the parent row height
  const handleImageLoad = useCallback(() => {
    if (imageRef.current && onImageLoad && displayImageUrl != null) {
      // Get the actual rendered height of the image
      const imageHeight = imageRef.current.clientHeight;
      onImageLoad(imageHeight, displayImageUrl);
    }
  }, [onImageLoad, displayImageUrl]);

  // Listen for container size changes on mount and update
  useEffect(() => {
    if (containerRef.current && onImageLoad && displayImageUrl != null) {
      // Copy ref value to a variable inside effect to avoid lint warnings
      const currentContainer = containerRef.current;
      const url = displayImageUrl; // Capture current URL in closure

      // Use ResizeObserver to detect container size changes
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          onImageLoad(entry.contentRect.height, url);
        }
      });

      observer.observe(currentContainer);

      return () => {
        observer.unobserve(currentContainer);
      };
    }
  }, [onImageLoad, displayImageUrl]);

  // Style for the left border, if color is provided
  const borderStyle =
    color != null && color !== ''
      ? {
          borderLeft: `4px solid ${color}`,
          paddingLeft: '12px',
        }
      : {};

  return (
    <div
      className={`attachment-item ${isServiceUnfurl ? 'service-unfurl' : ''}`}
      style={borderStyle}
      ref={containerRef}
    >
      {/* For service-based attachments like YouTube, show service info at the top */}
      {isServiceUnfurl && (
        <div className="attachment-service service-header">
          {service_icon != null && (
            <img
              src={service_icon}
              alt=""
              className="attachment-service-icon"
              onError={e => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          {<span className="attachment-service-name">{service_name}</span>}
        </div>
      )}

      {/* Author section */}
      {author_name != null && (
        <div className="attachment-author">
          {author_icon != null && (
            <img
              src={author_icon}
              alt=""
              className="attachment-author-icon"
              onError={e => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          {author_link != null ? (
            <a
              href={author_link}
              target="_blank"
              rel="noopener noreferrer"
              className="attachment-author-name"
            >
              {author_name}
            </a>
          ) : (
            <span className="attachment-author-name">{author_name}</span>
          )}
        </div>
      )}

      {/* Title section */}
      {title != null && (
        <div className="attachment-title">
          {title_link != null ? (
            <a href={title_link} target="_blank" rel="noopener noreferrer">
              {title}
            </a>
          ) : (
            <strong>{title}</strong>
          )}
        </div>
      )}

      {/* Render BLOCKS if they exist */}
      {hasBlocks && (
        <div className="attachment-blocks-container">
          <BlockRenderer blocks={blocks} messageTs={messageTs} />
        </div>
      )}

      {/* Render Legacy Content ONLY IF BLOCKS ARE NOT PRESENT */}
      {!hasBlocks && (
        <>
          {/* Text content */}
          {text != null && <div className="attachment-text">{text}</div>}

          {/* Fields (rendered as a grid) */}
          {fields != null && fields.length > 0 && (
            <div className="attachment-fields">
              {fields.map((field, index) => (
                <div
                  key={index}
                  className={`attachment-field ${
                    field.short ? 'short' : 'full'
                  }`}
                >
                  <div className="attachment-field-title">{field.title}</div>
                  <div className="attachment-field-value">{field.value}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Images - main image is clickable and links to title_link */}
      {displayImageUrl != null && (
        <div
          className={`attachment-image-container ${isServiceUnfurl ? 'service-image' : ''}`}
        >
          <a
            href={title_link ?? displayImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="attachment-image-link"
          >
            <img
              ref={imageRef}
              src={displayImageUrl}
              alt={title ?? 'Attached image'}
              className={
                isServiceUnfurl ? 'service-unfurl-image' : 'attachment-image'
              }
              onLoad={handleImageLoad}
              onError={e => {
                console.error('Failed to load image:', displayImageUrl);
                e.currentTarget.style.display = 'none';
              }}
            />
          </a>
        </div>
      )}

      {/* Thumbnail image (usually shown alongside text) */}
      {shouldShowThumbnail && (
        <div className="attachment-thumb-container">
          <a
            href={title_link ?? thumb_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src={thumb_url}
              alt="Thumbnail"
              className="attachment-thumb"
              onError={e => {
                console.error('Failed to load thumbnail:', thumb_url);
                e.currentTarget.style.display = 'none';
              }}
            />
          </a>
        </div>
      )}

      {/* Service/Footer - only show at bottom if not already shown at top */}
      {(service_name != null || service_icon != null) && !isServiceUnfurl && (
        <div className="attachment-service">
          {!(service_icon == null) && (
            <img
              src={service_icon}
              alt=""
              className="attachment-service-icon"
              onError={e => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          {<span className="attachment-service-name">{service_name}</span>}
        </div>
      )}
    </div>
  );
};
