import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@deepseek-ai/dsh-gstar-client-remotes',
  ['lib/types/index.js', 'lib/types/invariant.js'],
)
