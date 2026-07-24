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

  try {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, 6000);

    const response = await fetch(target.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; InningsLinkBot/1.0; +https://innings-zeta.vercel.app)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    clearTimeout(timer);

    const html = await response.text();

    const title = getMeta(html, 'og:title') || tagText(html, 'title') || target.hostname;
    const description = getMeta(html, 'og:description') || getMetaName(html, 'description') || '';
    let image = getMeta(html, 'og:image:secure_url') || getMeta(html, 'og:image') || '';
    const siteName = getMeta(html, 'og:site_name') || target.hostname.replace(/^www\./, '');

    if (image && !/^https?:\/\//i.test(image)) {
      try { image = new URL(image, target).toString(); } catch (e) { image = ''; }
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.status(200).json({
      url: target.toString(),
      title: decodeEntities(title).slice(0, 200),
      description: decodeEntities(description).slice(0, 300),
      image: image,
      siteName: decodeEntities(siteName)
    });
  } catch (err) {
    res.status(200).json({
      url: target.toString(),
      title: target.hostname,
      description: '',
      image: '',
      siteName: target.hostname.replace(/^www\./, '')
    });
  }
};

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
