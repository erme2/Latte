import { useEffect, useState } from 'react'
import { developmentRelease, latteReleaseDetails, latteReleaseLabel, loadLatteRelease, type LatteRelease } from '@erme2/latte'

/** Deployed Latte version, fixed at the bottom right of every screen. */
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
    <div className="release-badge" title={details} aria-label={details} data-testid="latte-release">
      {latteReleaseLabel(release)}
    </div>
  )
}
