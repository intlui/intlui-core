'use client';
import {useEffect, useMemo, useSyncExternalStore} from 'react';
import {createChatController} from './chat-controller.js';
import {createRendererCapabilities} from './capabilities.js';

export function useIntluiChat({endpoint = '/api/chat', apiBaseUrl, token, projectId, sessionKey, mode = 'generate', intent,
  maxTurns = 20, protocolVersion, capabilities = createRendererCapabilities(), fetchImpl} = {}) {
  const capabilitiesKey = JSON.stringify(capabilities);
  const controller = useMemo(() => createChatController({...(apiBaseUrl !== undefined ? {apiBaseUrl} : {endpoint}),
    token, projectId, mode, intent, maxTurns, protocolVersion, capabilities:JSON.parse(capabilitiesKey), fetchImpl}),
  [endpoint, apiBaseUrl, token, projectId, sessionKey, mode, intent, maxTurns, protocolVersion, capabilitiesKey, fetchImpl]);
  useEffect(() => () => controller.stop(), [controller]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return {...snapshot, send:controller.send, stop:controller.stop, reset:controller.reset};
}
