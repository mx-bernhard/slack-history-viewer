import { isObjectLike } from 'lodash-es';

export const createExtractInfos = () => {
  return (document: unknown) => {
    const infos = { url_ss: [] as string[] };

    const extract = (doc: unknown) => {
      if (isObjectLike(doc)) {
        for (const [key, value] of Object.entries(doc as object)) {
          if (key === 'url' && typeof value === 'string') {
            infos.url_ss.push(value);
          } else {
            extract(value);
          }
        }
      }
    };
    extract(document);
    return infos;
  };
};
