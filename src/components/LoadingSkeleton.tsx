import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 4, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: '#1F1F1F', opacity },
        style,
      ]}
    />
  );
}

export function ExpenseRowSkeleton() {
  return (
    <View style={skeletonStyles.row}>
      <Skeleton width={36} height={36} borderRadius={18} />
      <View style={skeletonStyles.rowInfo}>
        <Skeleton width="70%" height={12} />
        <Skeleton width="40%" height={10} style={{ marginTop: 6 }} />
      </View>
      <Skeleton width={60} height={14} />
    </View>
  );
}

export function CardSkeleton() {
  return (
    <View style={skeletonStyles.card}>
      <Skeleton width="50%" height={14} />
      <Skeleton width="100%" height={8} style={{ marginTop: 12 }} />
      <Skeleton width="30%" height={12} style={{ marginTop: 8 }} />
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowInfo: { flex: 1 },
  card: {
    margin: 16,
    backgroundColor: '#0A0A0A',
    borderRadius: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222222',
  },
});
