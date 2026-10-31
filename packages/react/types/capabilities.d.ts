import type { Capabilities } from '@intlui/protocol';

/** Built-in renderer profile, or a validated subset. Empty components disables UI. */
export function createRendererCapabilities(options?: {
  surface?: 'react' | 'widget';
  components?: readonly string[];
}): Capabilities;
