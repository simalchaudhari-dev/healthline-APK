import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { FONT } from '../../config/fonts';

/**
 * Circle avatar — photo when `uri` loads, otherwise Poppins initial letter.
 */
export default function AvatarInitial({
  name,
  uri,
  size = 44,
  backgroundColor = '#2e7d32',
  onPress,
  style,
  accessibilityLabel,
}) {
  const initial = (name || '?').trim().slice(0, 1).toUpperCase() || '?';
  const fontSize = Math.round(size * 0.46);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    setPhotoFailed(false);
  }, [uri]);

  const showPhoto = !!uri && !photoFailed;

  const circle = (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: showPhoto ? 'transparent' : backgroundColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {showPhoto ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <Text style={[styles.text, { fontSize, fontFamily: FONT.nova }]}>{initial}</Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
      >
        {circle}
      </Pressable>
    );
  }

  return circle;
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
