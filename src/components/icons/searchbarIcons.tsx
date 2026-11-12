import React from 'react';
import Search from 'lucide-react-native/icons/search';
import X from 'lucide-react-native/icons/x';

interface IconRenderProps {
  size: number;
  color: string;
}

/**
 * Paper's Searchbar draws its own icons from a font package. Pass these as `icon` and `clearIcon`
 * so it shows lucide icons like the rest of the app.
 */
export const renderSearchIcon = ({size, color}: IconRenderProps) => (
  <Search size={size} color={color} />
);

export const renderClearIcon = ({size, color}: IconRenderProps) => (
  <X size={size} color={color} />
);
