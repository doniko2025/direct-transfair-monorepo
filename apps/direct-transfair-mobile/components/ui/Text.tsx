// apps/direct-transfair-mobile/components/ui/Text.tsx
// =========================================================
// TEXTE & CHAMP v1.0 — Direct Transf'air (design « Corridor »)
// Remplace `Text` et `TextInput` de react-native : même API, mais la police (Manrope / Fraunces)
// est choisie d'après le `fontFamily` + `fontWeight` + `fontStyle` du style demandé.
//   • famille « serif » / Georgia / Fraunces → Fraunces ; toute autre (système, mono…) → Manrope ;
//   • `fontWeight` est converti en famille à poids unique (évite le faux gras Android / web) ;
//   • un <Text> imbriqué sans style de police propre hérite du parent, comme avant.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { createContext, useContext } from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';
import { withFont } from './fonts';

const NestedCtx = createContext(false);

export function Text({ style, ...rest }: TextProps & { ref?: React.Ref<RNText> }) {
  const nested = useContext(NestedCtx);
  let resolved: any = style;
  if (nested) {
    const f = (StyleSheet.flatten(style) || {}) as any;
    if (f.fontFamily || f.fontWeight || f.fontStyle) resolved = [style, withFont(style)];
  } else {
    resolved = withFont(style);
  }
  const node = <RNText {...rest} style={resolved} />;
  return nested ? node : <NestedCtx.Provider value={true}>{node}</NestedCtx.Provider>;
}
export type Text = RNText;

export function TextInput({ style, ...rest }: TextInputProps & { ref?: React.Ref<RNTextInput> }) {
  return <RNTextInput {...rest} style={withFont(style)} />;
}
export type TextInput = RNTextInput;

export default Text;
