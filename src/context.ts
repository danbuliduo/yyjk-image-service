import React from 'react';

export const ImageSelectionContext = React.createContext<{
  selectedTokens: Set<string>;
  toggleImage: (token: string, url: string) => void;
}>({
  selectedTokens: new Set(),
  toggleImage: () => {},
});