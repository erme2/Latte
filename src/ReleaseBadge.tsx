import { useEffect, useState } from 'react'
import { developmentRelease, latteReleaseDetails, latteReleaseLabel, loadLatteRelease, type LatteRelease } from '@erme2/latte'

const LATTE_REPOSITORY_URL = 'https://github.com/erme2/Latte'

/** "Built with Latte" link and deployed Latte version, fixed at the bottom right of every screen. */
export function ReleaseBadge() {
  const [release, setRelease] = useState<LatteRelease>(developmentRelease)

  useEffect(() => {
    let active = true
    void loadLatteRelease().then((loaded) => {
      if (active) setRelease(loaded)
    })
    return () => {
      active = false
    }
  }, [])

  const details = latteReleaseDetails(release)

  return (
    <div className="release-badge" title={details} data-testid="latte-release">
      <a href={LATTE_REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
        Built with Latte
      </a>{' '}
      - {latteReleaseLabel(release)}
    </div>
  )
}
