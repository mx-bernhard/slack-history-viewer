import type { SolrQueryResponse, SolrSearchArgs } from './search-indexer.js';

export const createSolrSearchArgs = (
  args: SolrSearchArgs
): [string, string][] => {
  return Object.entries(args)
    .filter(([_, v]) => v != null)
    .map(([k, v]) => [k, String(v)] as const);
};
export const solrHost = process.env.SLACK_SOLR_HOST ?? 'localhost';
export const solrPort = process.env.SLACK_SOLR_PORT ?? '8983';
export const solrCore = process.env.SLACK_SOLR_CORE ?? 'slack_messages';
export const solrApiBase = `http://${solrHost}:${solrPort}/solr/${solrCore}`;
export async function checkSolrConnection(): Promise<void> {
  console.log(`Connecting to Solr: ${solrApiBase}`);

  const response = await fetch(solrApiBase + '/admin/ping?wt=json', {
    method: 'GET',
    headers: { accept: 'application/json; charset=utf-8' },
  });
  if (response.status === 200) {
    console.log('✅ Successfully pinged Solr:', response.statusText);
  } else {
    console.error(
      '❌ Solr is not responding from ping. ' + response.statusText
    );
  }
}

export async function callSolrUpdate(json: unknown) {
  const jsonStringBody = JSON.stringify(json);
  const updateResponse = await fetch(solrApiBase + '/update/json?wt=json', {
    method: 'POST',
    headers: {
      accept: 'application/json; charset=utf-8',
      'content-length': String(Buffer.byteLength(jsonStringBody)),
      'content-type': 'application/json',
    },
    body: jsonStringBody,
  });
  if (updateResponse.status >= 400 && updateResponse.status < 500) {
    throw new Error(
      'Error ' +
        String(updateResponse.status) +
        ': Could not add documents to solr. Response: ' +
        updateResponse.statusText
    );
  }
  if (updateResponse.status !== 200) {
    console.error('!!!! Could not update index: ' + updateResponse.statusText);
    return false;
  }

  return true;
}

export const search = async (args: SolrSearchArgs) => {
  const queryParams = new URLSearchParams(
    createSolrSearchArgs(args)
  ).toString();
  const response = await fetch(solrApiBase + '/select?' + queryParams, {
    method: 'GET',
  });
  if (response.status !== 200) {
    throw new Error('Could not search: ' + response.statusText);
  }
  const result = (await response.json()) as SolrQueryResponse;
  return result;
};

export async function commitIndex() {
  console.log('Committing changes to Solr index...');
  await callSolrUpdate({ commit: {} });
  console.log('Solr commit successful.');
}

export async function rollback() {
  console.log('Rollback changes to Solr index...');
  await callSolrUpdate({ rollback: {} });
  console.log('Rollback successful.');
}
