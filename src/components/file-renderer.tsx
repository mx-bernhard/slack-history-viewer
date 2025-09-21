import type { CSSProperties, SyntheticEvent } from 'react';
import type { SlackFile } from '../types';

const isImage = (mimetype: string): boolean => {
  return [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/jpg',
  ].includes(mimetype.toLowerCase());
};

const getFileUrl = (
  file: SlackFile,
  chatId: string | null
): string | undefined => {
  const isAbsoluteUrl = file.url_private?.startsWith('https://') ?? false;
  if (file.name != null && isAbsoluteUrl) {
    return `/data/__uploads/${file.id}/${file.name}`;
  } else if (chatId != null && !isAbsoluteUrl) {
    return `/data/${chatId}/${String(file.url_private)}`;
  }
  return '#';
};

export const FileRenderer = ({
  file,
  onImageLoad,
  chatId,
}: {
  file: SlackFile;
  onImageLoad?: (height: number, url: string) => void;
  chatId: string;
}) => {
  const fileUrl = getFileUrl(file, chatId);
  const isImageType = isImage(file.mimetype ?? '');

  const displayUrl = isImageType ? fileUrl : null;

  const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    if (onImageLoad != null && displayUrl != null) {
      onImageLoad(event.currentTarget.naturalHeight, displayUrl);
    }
  };

  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.display = 'none';

    console.error('Failed to load image:', displayUrl);
  };

  const imageStyle: CSSProperties = {
    maxWidth: '360px',
    maxHeight: '200px',
    display: 'block',
    marginTop: '5px',
    borderRadius: '4px',
    border: '1px solid #ccc',
  };

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

export const FilesRenderer = ({
  files,
  onImageLoad,
  chatId,
}: {
  files: SlackFile[];
  onImageLoad?: (height: number, url: string) => void;
  chatId: string;
}) => {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="files-container">
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
