import React from "react";
import { Text, TextProps } from "react-native";
import { usePreferences } from "./preferences";
import { phrase } from "./phrases";
export function LocalizedText({ children, ...props }: TextProps) {
  const { preferences } = usePreferences();
  return (
    <Text {...props}>
      {typeof children === "string"
        ? phrase(preferences.language, children)
        : children}
    </Text>
  );
}
