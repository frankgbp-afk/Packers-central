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
  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(m => m[0]);
  return items.slice(0, 12).map(block => ({
    title: field(block, 'title'),
    url: field(block, 'link'),
    publishedAt: field(block, 'pubDate') || field(block, 'dc:date'),
    summary: field(block, 'description'),
    source: feed.source,
    icon: feed.icon
  })).filter(item => item.title && item.url);
}

const output = { updatedAt: new Date().toISOString(), sources: {} };
for (const feed of feeds) {
  try {
    const response = await fetch(feed.url, { headers: { 'user-agent': 'PackersCentral/1.0 personal news dashboard' } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    output.sources[feed.key] = parseRss(await response.text(), feed);
    console.log(`${feed.source}: ${output.sources[feed.key].length} stories`);
  } catch (error) {
    console.error(`${feed.source} failed:`, error.message);
    output.sources[feed.key] = [];
  }
}

await mkdir('data', { recursive: true });
await writeFile('data/news.json', JSON.stringify(output, null, 2) + '\n');
