import { CSSProperties, SyntheticEvent } from 'react';
import { SlackFile } from '../types';

// Basic check for common image mimetypes
const isImage = (mimetype: string): boolean => {
  return [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/jpg', // Add jpg as a common alias
  ].includes(mimetype.toLowerCase());
};

const getFileUrl = (
  file: SlackFile,
  chatId: string | null
): string | undefined => {
  const isAbsoluteUrl = file.url_private?.startsWith('https://') ?? false;
  if (file.name != null && isAbsoluteUrl) {
    return `/data/__uploads/${file.id}/${String(file.name)}`;
  } else if (chatId != null && !isAbsoluteUrl) {
    return `/data/${chatId}/${String(file.url_private)}`;
  }
  return '#';
};

// Simple component to render a file, either as an image preview or a download link
export const FileRenderer = ({
  file,
  onImageLoad,
  chatId,
}: {
  file: SlackFile;
  onImageLoad?: (height: number, url: string) => void;
  chatId: string;
}) => {
  // Construct the URL using chatId
  // Example: /data/D123ABC/attachments/image.png
  const fileUrl = getFileUrl(file, chatId);
  const isImageType = isImage(file.mimetype ?? '');
  // Use the same logic for displayUrl, which depends on fileUrl
  const displayUrl = isImageType ? fileUrl : null;

  const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    if (onImageLoad != null && displayUrl != null) {
      onImageLoad(event.currentTarget.naturalHeight, displayUrl);
    }
  };

  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    // Hide the image element if it fails to load
    event.currentTarget.style.display = 'none';
    // Optionally, render a fallback or log an error
    console.error('Failed to load image:', displayUrl);
  };

  // Define consistent styling for previews
  const imageStyle: CSSProperties = {
    maxWidth: '360px', // Match thumb_360 max width
    maxHeight: '200px', // Limit height to prevent huge images
    display: 'block', // Ensure it takes block space
    marginTop: '5px', // Add some space above
    borderRadius: '4px', // Slightly rounded corners
    border: '1px solid #ccc', // Subtle border
  };

  // Explicit check for imageUrl being non-null
  if (isImageType && fileUrl != null) {
    return (
      <div className="file-item file-image-preview">
        <a href={fileUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={displayUrl ?? ''}
            alt={file.title}
            style={imageStyle}
            onLoad={handleLoad}
            onError={handleError}
          />
        </a>
        {/* Optional: Display file name below image */}
        {/* <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={file.name}>
          {file.name}
        </a> */}
      </div>
    );
  } else {
    // Render a download link for non-image files
    return (
      <div className="file-item file-download-link">
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          download={file.name}
        >
          📄 {file.name} ({file.pretty_type ?? file.filetype})
        </a>
      </div>
    );
  }
};

// Component to render a list of files
export const FilesRenderer = ({
  files,
  onImageLoad,
  chatId,
}: {
  files: SlackFile[];
  onImageLoad?: (height: number, url: string) => void;
  chatId: string;
}) => {
  // Simplify the check for an empty array
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="files-container" style={{ marginTop: '8px' }}>
      {files.map(file => (
        <FileRenderer
          key={file.id}
          file={file}
          onImageLoad={onImageLoad}
          chatId={chatId}
        />
      ))}
    </div>
  );
};
