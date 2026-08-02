import React, { useState, useEffect, useRef } from 'react';
import { Text, Animated } from 'react-native';

interface Props {
  value: number;
  duration?: number;
  style?: any;
  prefix?: string;
}

export default function AnimatedNumber({ value, duration = 1000, style, prefix = '' }: Props) {
  const [displayValue, setDisplayValue] = useState(0);
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reset to 0 when the value changes
    animValue.setValue(0);

    const listener = animValue.addListener(({ value }) => {
      setDisplayValue(Math.round(value));
    });

    Animated.timing(animValue, {
      toValue: value,
      duration: duration,
      useNativeDriver: false, // Text doesn't support native driver
    }).start();

    return () => {
      animValue.removeListener(listener);
    };
  }, [value, duration]);

  return (
    <Text style={style}>{prefix}{displayValue.toLocaleString('en-IN')}</Text>
  );
}