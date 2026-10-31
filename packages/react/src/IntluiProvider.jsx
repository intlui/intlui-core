import React, { createContext, useContext, useMemo } from 'react';

const AppearanceContext = createContext({ theme: 'light', locale: 'en', components: {}, classNames: {} });

// Appearance is host configuration, separate from sandbox state and data.
export function useAppearance({ theme, locale, components, classNames, host, profiles }) {
  const parent = useContext(AppearanceContext);
  return useMemo(() => ({
    theme: theme ?? parent.theme,
    locale: locale ?? parent.locale,
    components: { ...parent.components, ...components },
    classNames: { ...parent.classNames, ...classNames },
    host: host ?? parent.host,
    profiles: profiles ?? parent.profiles,
  }), [parent, theme, locale, components, classNames, host, profiles]);
}

export function IntluiProvider({ children, ...appearance }) {
  const value = useAppearance(appearance);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
