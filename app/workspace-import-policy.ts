/** An existing encrypted workspace owns its empty collections, including deleted habits. */
export function shouldSeedRemoteWorkspace(hasRemoteStructure: boolean, localItemCount: number): boolean {
  return !hasRemoteStructure && localItemCount > 0;
}
