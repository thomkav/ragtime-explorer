import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { links } from '@ragtime/client'

import { onApp } from '../config.ts'

/**
 * The answer's markdown. `rt://slug/id` citations resolve through the client
 * package's `links.fromCitation` and nothing else (contract §4); every other
 * URL goes through react-markdown's own transform, which drops unsafe
 * schemes. Links open on the public site in a new tab.
 */
export function Markdown({ text, appUrl, className }: { text: string; appUrl: string; className?: string }) {
  const urlTransform = (url: string): string => {
    if (url.startsWith('rt://')) {
      try {
        return onApp(appUrl, links.fromCitation(url))
      } catch {
        return ''
      }
    }
    return defaultUrlTransform(url)
  }
  return (
    <div className={className ? 'md ' + className : 'md'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={urlTransform}
        components={{
          a: ({ href, children }) =>
            href ? (
              <a href={href} target="_blank" rel="noreferrer noopener">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
