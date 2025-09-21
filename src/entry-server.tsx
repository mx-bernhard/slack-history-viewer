import ReactDOMServer from 'react-dom/server';

export function render(url: string): string {
  console.log(`[SSR Render] Rendering for URL: ${url}`);

  const html = ReactDOMServer.renderToString(<div />);

  return html;
}
