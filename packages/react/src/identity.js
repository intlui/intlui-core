// Array encoding prevents delimiter collisions. Data revisions are deliberately
// absent: ordinary data updates must retain the same runtime and React state.
export function blockIdentity(state, blockId) {
  return JSON.stringify([state.projectId, state.conversationId, state.turnId, state.turnRevision, blockId]);
}
