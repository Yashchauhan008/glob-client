import { Header } from '../components/ui'
import PinsPanel from '../components/Pins'
import { useTeams } from '../teams'

/** The team's shared map: everyone in the workspace sees and adds the same pins. */
export default function MapPage() {
  const { current } = useTeams()
  return (
    <>
      <Header title="Map" />
      <p className="muted at-help">Places {current?.name ?? 'your team'} has pinned: where you have been, where to meet next, good spots. Everyone in this workspace sees them.</p>
      <PinsPanel base="/pins" height={520} />
    </>
  )
}
