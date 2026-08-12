import { mkdir, writeFile } from 'node:fs/promises';

const feeds = [
  { key: 'packers', source: 'Packers.com', icon: 'GB', url: 'https://www.packers.com/rss/news' },
  { key: 'espn', source: 'ESPN NFL', icon: 'ESPN', url: 'https://www.espn.com/espn/rss/nfl/news' }
];

const decode = value => String(value ?? '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const decodeAttr = value => String(value ?? '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

function field(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decode(match[1]) : '';
}

function imageFromBlock(block) {
  const candidates = [
    /<media:content\b[^>]*\burl=["']([^"']+)["'][^>]*>/i,
    /<media:thumbnail\b[^>]*\burl=["']([^"']+)["'][^>]*>/i,
    /<enclosure\b[^>]*\burl=["']([^"']+)["'][^>]*(?:type=["']image\/[^"']+["'])?[^>]*>/i,
    /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i
  ];
  for (const pattern of candidates) {
    const match = block.match(pattern);
    if (match?.[1] && /^https?:\/\//i.test(decodeAttr(match[1]))) return decodeAttr(match[1]);
  }
  return '';
}

function parseRss(xml, feed) {
  let records = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(m => m[0]);
  const atom = records.length === 0;
  if (atom) records = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(m => m[0]);
  return records.slice(0, 12).map(block => {
    let url = field(block, 'link');
    if (!url && atom) url = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i)?.[1] || '';
    return {
      title: field(block, 'title'),
      url: decode(url),
      publishedAt: field(block, 'pubDate') || field(block, 'published') || field(block, 'updated') || field(block, 'dc:date'),
      summary: field(block, 'description') || field(block, 'summary') || field(block, 'content'),
      image: imageFromBlock(block),
      source: feed.source,
      icon: feed.icon
    };
  }).filter(item => item.title && item.url);
}

function parseEspnHtml(html) {
  const seen = new Set();
  const stories = [];
  const pattern = /<a\b[^>]*href=["']([^"']*\/nfl\/story\/_\/id\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const title = decode(match[2]);
    if (!title || title.length < 12) continue;
    const url = match[1].startsWith('http') ? match[1] : `https://www.espn.com${match[1]}`;
    if (seen.has(url)) continue;
    seen.add(url);
    stories.push({ title, url, publishedAt: '', summary: '', image: imageFromBlock(match[0]), source: 'ESPN NFL', icon: 'ESPN' });
    if (stories.length >= 12) break;
  }
  return stories;
}

function parseAcmeHtml(html) {
  const seen = new Set();
  const stories = [];
  const pattern = /<a\b[^>]*href=["'](https?:\/\/www\.acmepackingcompany\.com\/[^"'#?]+|\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const title = decode(match[2]);
    let url = match[1];
    if (url.startsWith('/')) url = `https://www.acmepackingcompany.com${url}`;
    if (!url.includes('acmepackingcompany.com/') || title.length < 18) continue;
    if (/^(about|contact|privacy|terms|newsletter|podcast|masthead|search|facebook|twitter|youtube)/i.test(title)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    stories.push({ title, url, publishedAt: '', summary: '', image: imageFromBlock(match[0]), source: 'Acme Packing Company', icon: 'ACME' });
    if (stories.length >= 12) break;
  }
  return stories;
}

async function fetchEspnFallback() {
  try {
    const api = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=12', { headers: { 'user-agent': 'Mozilla/5.0 PackersCentral/1.0' } });
    if (api.ok) {
      const json = await api.json();
      const stories = (json.articles || []).slice(0, 12).map(article => ({
        title: article.headline || article.title || '',
        url: article.links?.web?.href || article.link || '',
        publishedAt: article.published || article.lastModified || '',
        summary: article.description || '',
        image: article.images?.[0]?.url || article.images?.[0]?.href || '',
        source: 'ESPN NFL',
        icon: 'ESPN'
      })).filter(item => item.title && item.url);
      if (stories.length) return stories;
    }
  } catch (error) {
    console.error('ESPN JSON fallback failed:', error.message);
  }
  try {
    const page = await fetch('https://www.espn.com/nfl/', { headers: { 'user-agent': 'Mozilla/5.0 PackersCentral/1.0' } });
    if (page.ok) return parseEspnHtml(await page.text());
  } catch (error) {
    console.error('ESPN HTML fallback failed:', error.message);
  }
  return [];
}

async function fetchAcme() {
  const candidates = [
    'https://www.acmepackingcompany.com/rss/index.xml',
    'https://www.acmepackingcompany.com/rss',
    'https://www.acmepackingcompany.com/feed'
  ];
  for (const url of candidates) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 PackersCentral/1.0', 'accept': 'application/rss+xml, application/xml, text/xml, */*' }, redirect: 'follow' });
      if (!response.ok) continue;
      const stories = parseRss(await response.text(), { source: 'Acme Packing Company', icon: 'ACME' });
      if (stories.length) {
        console.log(`Acme Packing Company RSS: ${stories.length} stories via ${url}`);
        return stories;
      }
    } catch (error) {
      console.error(`Acme feed ${url} failed:`, error.message);
    }
  }
  try {
    const page = await fetch('https://www.acmepackingcompany.com/', { headers: { 'user-agent': 'Mozilla/5.0 PackersCentral/1.0' }, redirect: 'follow' });
    if (page.ok) {
      const stories = parseAcmeHtml(await page.text());
      console.log(`Acme Packing Company HTML: ${stories.length} stories`);
      return stories;
    }
  } catch (error) {
    console.error('Acme HTML fallback failed:', error.message);
  }
  return [];
}

const output = { updatedAt: new Date().toISOString(), sources: {} };
for (const feed of feeds) {
  try {
    const response = await fetch(feed.url, { headers: { 'user-agent': 'Mozilla/5.0 PackersCentral/1.0', 'accept': 'application/rss+xml, application/xml, text/xml, */*' } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    output.sources[feed.key] = parseRss(await response.text(), feed);
    if (feed.key === 'espn' && output.sources.espn.length === 0) output.sources.espn = await fetchEspnFallback();
    console.log(`${feed.source}: ${output.sources[feed.key].length} stories`);
  } catch (error) {
    console.error(`${feed.source} failed:`, error.message);
    output.sources[feed.key] = feed.key === 'espn' ? await fetchEspnFallback() : [];
  }
}

output.sources.acme = await fetchAcme();

await mkdir('data', { recursive: true });
await writeFile('data/news.json', JSON.stringify(output, null, 2) + '\n');
