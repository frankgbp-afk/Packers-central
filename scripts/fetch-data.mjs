import { mkdir, writeFile } from 'node:fs/promises';

const feeds = [
  { key: 'packers', source: 'Packers.com', icon: 'G', url: 'https://www.packers.com/rss/news' },
  { key: 'espn', source: 'ESPN NFL', icon: 'ESPN', url: 'https://www.espn.com/espn/rss/nfl/news' }
];

const decode = value => String(value ?? '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function field(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decode(match[1]) : '';
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
    stories.push({ title, url, publishedAt: '', summary: '', source: 'ESPN NFL', icon: 'ESPN' });
    if (stories.length >= 12) break;
  }
  return stories;
}

const output = { updatedAt: new Date().toISOString(), sources: {} };
for (const feed of feeds) {
  try {
    const response = await fetch(feed.url, { headers: { 'user-agent': 'Mozilla/5.0 PackersCentral/1.0', 'accept': 'application/rss+xml, application/xml, text/xml, */*' } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const text = await response.text();
    output.sources[feed.key] = parseRss(text, feed);
    if (feed.key === 'espn' && output.sources.espn.length === 0) {
      const page = await fetch('https://www.espn.com/nfl/', { headers: { 'user-agent': 'Mozilla/5.0 PackersCentral/1.0' } });
      if (page.ok) output.sources.espn = parseEspnHtml(await page.text());
    }
    console.log(`${feed.source}: ${output.sources[feed.key].length} stories`);
  } catch (error) {
    console.error(`${feed.source} failed:`, error.message);
    output.sources[feed.key] = [];
  }
}

await mkdir('data', { recursive: true });
await writeFile('data/news.json', JSON.stringify(output, null, 2) + '\n');
