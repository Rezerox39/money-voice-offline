import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  driftX: number;
  driftY: number;
  color: string;
  anim: Animated.Value;
}

const COLORS = ['#00FF66', '#FFB000', '#FF3333', '#FF8C00', '#7FFF00'];

/**
 * Subtle floating particle field for AMOLED backgrounds.
 * Renders soft, slow-moving dots that add depth without distraction.
 */
export function ParticleField({ active = true, count = 24 }: { active?: boolean; count?: number }) {
  const particlesRef = useRef<Particle[]>([]);
  const animsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (!active) return;

    // Initialize particles once
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size: 1.5 + Math.random() * 2.5,
          opacity: 0.2 + Math.random() * 0.6,
          driftX: (Math.random() - 0.5) * 8,
          driftY: -2 - Math.random() * 4,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          anim: new Animated.Value(0),
        });
      }
    }

    // Start drift animation loop
    particlesRef.current.forEach((p) => {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(p.anim, { toValue: 1, duration: 6000 + Math.random() * 4000, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(p.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      anim.start();
      animsRef.current.push(anim);
    });

    return () => {
      animsRef.current.forEach((a) => a.stop());
      animsRef.current = [];
    };
  }, [active, count]);

  return (
    <View pointerEvents="none" style={styles.container}>
      {particlesRef.current.map((p, i) => {
        const translateY = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [p.y, p.y - 40],
        });
        const translateX = p.anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [p.x, p.x + p.driftX, p.x],
        });
        const opacity = p.anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [p.opacity, p.opacity * 1.4, p.opacity],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateX }, { translateY }],
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
});
