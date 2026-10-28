// Vercel Serverless Function — GET /api/unfurl?url=<encoded url>
// Fetches the target page server-side (browsers can't do this themselves —
// most sites block cross-origin fetches) and extracts Open Graph tags so
// the chat can show an iMessage-style rich link card.

module.exports = async function handler(req, res) {
  const rawUrl = req.query.url;
  if (!rawUrl) {
    res.status(400).json({ error: 'Missing url' });
    return;
  }

  let target;
  try {
    target = new URL(rawUrl);
    if (target.protocol !== 'http:' && target.protocol !== 'https:') throw new Error('bad protocol');
  } catch (e) {
    res.status(400).json({ error: 'Invalid url' });
    return;
  }

  // v7.81.2: news sites (NYT, The Athletic, WSJ…) block unknown bots, so the
  // first try came back with just the hostname. Try the crawlers those sites
  // let through for link cards, then a regular browser, then the site's
  // oEmbed, and finally a title made from the article's own URL.
  const agents = [
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Twitterbot/1.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (compatible; InningsLinkBot/1.0; +https://innings-zeta.vercel.app)'
  ];
  const host = target.hostname.replace(/^www\./, '');
  let best = null;
  const started = Date.now();
  for (let i = 0; i < agents.length && Date.now() - started < 7000; i++) {
    const got = await tryFetch(target, agents[i], 3500);
    if (!got) continue;
    if (got.title && got.title !== host && got.title !== target.hostname && !isBlockTitle(got.title)) {
      if (!best || (!best.image && got.image)) best = got;
      if (best.image) break;
    }
  }
  if (!best || !best.image) {
    const oe = await tryOembed(target);
    if (oe && oe.title) best = { title: oe.title, description: (best && best.description) || '', image: oe.image || (best && best.image) || '', siteName: oe.siteName || (best && best.siteName) || '' };
  }
  const slugTitle = titleFromSlug(target);
  const out = {
    url: target.toString(),
    title: decodeEntities((best && best.title) || slugTitle || host).slice(0, 200),
    description: decodeEntities((best && best.description) || '').slice(0, 300),
    image: (best && best.image) || '',
    siteName: decodeEntities((best && best.siteName) || prettySite(host))
  };
  // only cache a real card — a bare one should be tried again next time
  res.setHeader('Cache-Control', best ? 's-maxage=86400, stale-while-revalidate' : 'no-store');
  res.status(200).json(out);
};

async function tryFetch(target, ua, ms) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, ms);
  try {
    const response = await fetch(target.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': ua, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' }
    });
    if (!response.ok) { clearTimeout(timer); return null; }
    const html = (await response.text()).slice(0, 600000);
    clearTimeout(timer);
    const finalUrl = response.url ? new URL(response.url) : target;
    const title = getMeta(html, 'og:title') || getMetaName(html, 'twitter:title') || tagText(html, 'title') || '';
    const description = getMeta(html, 'og:description') || getMetaName(html, 'description') || '';
    let image = getMeta(html, 'og:image:secure_url') || getMeta(html, 'og:image') || getMetaName(html, 'twitter:image') || '';
    if (image && !/^https?:\/\//i.test(image)) {
      try { image = new URL(image, finalUrl).toString(); } catch (e) { image = ''; }
    }
    return { title: decodeEntities(title).trim(), description: description, image: decodeEntities(image), siteName: getMeta(html, 'og:site_name') || '' };
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

async function tryOembed(target) {
  const h = target.hostname.replace(/^www\./, '');
  let ep = null;
  if (/(^|\.)nytimes\.com$/.test(h)) ep = 'https://www.nytimes.com/svc/oembed/json/?url=';
  else if (/(^|\.)youtube\.com$|^youtu\.be$/.test(h)) ep = 'https://www.youtube.com/oembed?format=json&url=';
  else if (/(^|\.)(twitter|x)\.com$/.test(h)) ep = 'https://publish.twitter.com/oembed?url=';
  if (!ep) return null;
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 2500);
  try {
    const r = await fetch(ep + encodeURIComponent(target.toString()), { signal: controller.signal, headers: { 'User-Agent': 'facebookexternalhit/1.1' } });
    clearTimeout(timer);
    if (!r.ok) return null;
    const j = await r.json();
    const title = j.title || (j.author_name ? j.author_name + ' on X' : '');
    return { title: title, image: j.thumbnail_url || '', siteName: j.provider_name || '' };
  } catch (e) { clearTimeout(timer); return null; }
}

function isBlockTitle(t) {
  return /access denied|just a moment|attention required|are you a robot|captcha|forbidden|blocked|please enable|security check/i.test(t);
}

// "/2026/10/26/sports/basketball/warriors-hawks-curry.html" → "Warriors hawks curry"
function titleFromSlug(target) {
  const parts = target.pathname.split('/').filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = decodeURIComponent(parts[i]).replace(/\.(html?|php|aspx?)$/i, '');
    if (/^(index|amp|story|article|news)$/i.test(seg)) continue;
    if (/^[\d]+$/.test(seg) || seg.indexOf('-') < 0) continue;
    const words = seg.replace(/[-_]+/g, ' ').replace(/\b[0-9a-f]{8,}\b/gi, '').trim();
    if (words.split(' ').length < 2) continue;
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return '';
}

const SITE_NAMES = { 'nytimes.com': 'The New York Times', 'theathletic.com': 'The Athletic', 'espn.com': 'ESPN', 'mlb.com': 'MLB.com', 'nba.com': 'NBA.com', 'nfl.com': 'NFL.com', 'sfchronicle.com': 'San Francisco Chronicle', 'wsj.com': 'The Wall Street Journal', 'washingtonpost.com': 'The Washington Post', 'theringer.com': 'The Ringer' };
function prettySite(host) { return SITE_NAMES[host] || host; }

function getMeta(html, property) {
  var re1 = new RegExp('<meta[^>]+property=["\']' + property + '["\'][^>]+content=["\']([^"\']*)["\']', 'i');
  var re2 = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+property=["\']' + property + '["\']', 'i');
  var m = html.match(re1) || html.match(re2);
  return m ? m[1] : null;
}

function getMetaName(html, name) {
  var re1 = new RegExp('<meta[^>]+name=["\']' + name + '["\'][^>]+content=["\']([^"\']*)["\']', 'i');
  var re2 = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']' + name + '["\']', 'i');
  var m = html.match(re1) || html.match(re2);
  return m ? m[1] : null;
}

function tagText(html, tag) {
  var m = html.match(new RegExp('<' + tag + '[^>]*>([^<]*)</' + tag + '>', 'i'));
  return m ? m[1].trim() : null;
}

function decodeEntities(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'");
}
