import { useEffect } from 'react'

type JsonLd = Record<string, unknown>

interface SeoHeadProps {
  title: string
  description: string
  path?: string
  image?: string
  noindex?: boolean
  jsonLd?: JsonLd[]
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute(attr, key)
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', content)
}

export function SeoHead({ title, description, path = '/', image = '/og/myba-og.svg', noindex = false, jsonLd = [] }: SeoHeadProps) {
  useEffect(() => {
    const canonicalUrl = new URL(path, window.location.origin).toString()
    const imageUrl = new URL(image, window.location.origin).toString()

    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')

    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', canonicalUrl)
    upsertMeta('property', 'og:image', imageUrl)

    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', imageUrl)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', canonicalUrl)

    document.querySelectorAll('script[data-seo-json-ld="true"]').forEach((node) => node.remove())

    jsonLd.forEach((entry) => {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.dataset.seoJsonLd = 'true'
      script.text = JSON.stringify(entry)
      document.head.appendChild(script)
    })

    return () => {
      document.querySelectorAll('script[data-seo-json-ld="true"]').forEach((node) => node.remove())
    }
  }, [title, description, path, image, noindex, jsonLd])

  return null
}
