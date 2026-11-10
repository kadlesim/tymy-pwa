// BBCode to HTML conversion.
//
// Input is escaped first and only a fixed set of BBCode tags is turned into
// markup, so the output is safe without an external sanitizer.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|rgb\(\s*[\d,\s%.]+\s*\))$/

function safeUrl(url: string): string {
  const trimmed = url.trim()
  if (/^(https?:|mailto:|\/)/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function bbcodeToHtml(bbcode: string): string {
  if (!bbcode) return ''

  // Normalise newlines and escape everything up front.
  let html = escapeHtml(bbcode.replace(/\r\n/g, '\n'))

  // Protect [code] blocks from further formatting.
  const codeBlocks: string[] = []
  html = html.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, (_m, inner: string) => {
    codeBlocks.push(inner)
    return `\u0000CODE${codeBlocks.length - 1}\u0000`
  })

  // Lists (must run before inline tags so [*] items are captured).
  html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_m, inner: string) => {
    const items = inner
      .split(/\[\*\]/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => `<li>${s}</li>`)
      .join('')
    return `<ul>${items}</ul>`
  })

  // Images.
  html = html.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (_m, src: string) => {
    return `<img src="${safeUrl(src)}" alt="" loading="lazy" />`
  })

  // Links.
  html = html.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (_m, url: string, label: string) => {
    return `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
  })
  html = html.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_m, url: string) => {
    return `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${url}</a>`
  })
  html = html.replace(/\[email=([^\]]+)\]([\s\S]*?)\[\/email\]/gi, (_m, mail: string, label: string) => {
    return `<a href="mailto:${mail}">${label}</a>`
  })

  // Quotes.
  html = html.replace(/\[quote=([^\]]+)\]([\s\S]*?)\[\/quote\]/gi, (_m, author: string, inner: string) => {
    return `<blockquote><cite>${author}</cite>${inner}</blockquote>`
  })
  html = html.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote>$1</blockquote>')

  // Simple inline styles.
  html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>')
  html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>')
  html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>')
  html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>')

  html = html.replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi, (_m, color: string, inner: string) => {
    const c = color.trim()
    return SAFE_COLOR.test(c) ? `<span style="color: ${c}">${inner}</span>` : inner
  })
  html = html.replace(/\[size=([^\]]+)\]([\s\S]*?)\[\/size\]/gi, (_m, size: string, inner: string) => {
    const n = parseInt(size, 10)
    return n >= 1 && n <= 7 ? `<span style="font-size: ${n * 3}px">${inner}</span>` : inner
  })
  html = html.replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div style="text-align: center">$1</div>')
  html = html.replace(/\[right\]([\s\S]*?)\[\/right\]/gi, '<div style="text-align: right">$1</div>')
  html = html.replace(/\[left\]([\s\S]*?)\[\/left\]/gi, '<div style="text-align: left">$1</div>')

  // Restore code blocks.
  html = html.replace(/\u0000CODE(\d+)\u0000/g, (_m, idx: string) => {
    return `<pre><code>${codeBlocks[parseInt(idx, 10)] ?? ''}</code></pre>`
  })

  // Remaining newlines become line breaks.
  html = html.replace(/\n/g, '<br />')

  return html
}

export function previewBbcode(bbcode: string): string {
  return bbcodeToHtml(bbcode)
}

// Convert a limited HTML subset back to BBCode (used when editing a post).
export function htmlToBbcode(html: string): string {
  if (!html) return ''

  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, '[b]$1[/b]')
    .replace(/<b>([\s\S]*?)<\/b>/gi, '[b]$1[/b]')
    .replace(/<em>([\s\S]*?)<\/em>/gi, '[i]$1[/i]')
    .replace(/<i>([\s\S]*?)<\/i>/gi, '[i]$1[/i]')
    .replace(/<u>([\s\S]*?)<\/u>/gi, '[u]$1[/u]')
    .replace(/<s>([\s\S]*?)<\/s>/gi, '[s]$1[/s]')
    .replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      return href.startsWith('mailto:') ? `[email=${href.slice(7)}]${label}[/email]` : `[url=${href}]${label}[/url]`
    })
    .replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, '[img]$1[/img]')
    .replace(/<li>([\s\S]*?)<\/li>/gi, '[*]$1')
    .replace(/<ul>([\s\S]*?)<\/ul>/gi, '[list]$1[/list]')
    .replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, '[quote]$1[/quote]')
    .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, '[code]$1[/code]')
    .replace(/<[^>]+>/g, '')

  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

export function stripBbcode(bbcode: string): string {
  return bbcode
    .replace(/\[\/?(b|i|u|s|url|img|quote|code|list|\*|color|size|center|left|right|email|youtube)(=[^\]]*)?\]/gi, '')
    .replace(/\[\/?[a-z]+\]/gi, '')
    .trim()
}

export function hasBbcode(text: string): boolean {
  return /\[\/?(b|i|u|s|url|img|quote|code|list|\*|color|size|center|left|right|email|youtube)(=[^\]]*)?\]/i.test(text)
}
