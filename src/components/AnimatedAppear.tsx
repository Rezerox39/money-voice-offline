import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

interface AnimatedAppearProps {
  index?: number;
  children: React.ReactNode;
  style?: any;
  duration?: number;
}

/**
 * Subtle fade+slide entrance for list rows / cards.
 * Staggered by `index` so long lists cascade in smoothly.
 */
export function AnimatedAppear({ index = 0, children, style, duration = 260 }: AnimatedAppearProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration,
      delay: Math.min(index * 40, 500),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
