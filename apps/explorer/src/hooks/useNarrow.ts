import { useEffect, useState } from 'react'

/**
 * The one breakpoint, read in React as well as in CSS.
 *
 * Most of the narrow layout is the stylesheet's business and stays there. Two things are
 * not: whether the accepted brief and the trail start open. Both are panels that are worth
 * their room on a wide screen and cost the answer its room on a phone, and there is no way
 * to open a `<details>` from CSS — `open` is an attribute, so the decision has to be made
 * where the element is written. Same query string as `styles.css`; changing one means
 * changing the other.
 */
export const NARROW_QUERY = '(max-width: 900px)'

export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    const onChange = () => setNarrow(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}
