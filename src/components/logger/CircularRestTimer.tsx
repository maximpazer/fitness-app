import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularRestTimerProps {
    visible: boolean;
    startTime: number | null;
    duration: number;
    onSkip: () => void;
    onAddTime: (seconds: number) => void;
}

export const CircularRestTimer: React.FC<CircularRestTimerProps> = ({
    visible,
    startTime,
    duration,
    onSkip,
    onAddTime
}) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const progress = useSharedValue(1);

    const CIRCLE_SIZE = 250;
    const STROKE_WIDTH = 12;
    const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

    useEffect(() => {
        if (!visible || !startTime) return;

        const updateTimer = () => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = Math.max(0, duration - elapsed);
            setTimeLeft(remaining);
            progress.value = withTiming(remaining / duration, { duration: 100 });

            if (remaining === 0) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onSkip(); // Auto-skip when done
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [visible, startTime, duration, onSkip]);

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
    }));

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const getTimerColor = () => {
        const percentage = (timeLeft / duration) * 100;
        if (percentage > 50) return '#10b981'; // green
        if (percentage > 25) return '#f59e0b'; // yellow
        return '#ef4444'; // red
    };

    const BUTTON_WIDTH = Dimensions.get('window').width * 0.8;

    return (
        <Modal
            transparent={true}
            visible={visible}
            animationType="fade"
            statusBarTranslucent={true}
            onRequestClose={onSkip}
        >
            <TouchableOpacity
                activeOpacity={1}
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }}
                onPress={onSkip}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={(e) => e.stopPropagation()}
                    className="items-center justify-center w-full"
                >
                    {/* Circular Progress Ring */}
                    <View style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }} className="items-center justify-center">
                        <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} style={{ position: 'absolute' }}>
                            {/* Background Circle */}
                            <Circle
                                cx={CIRCLE_SIZE / 2}
                                cy={CIRCLE_SIZE / 2}
                                r={RADIUS}
                                stroke="#1f2937"
                                strokeWidth={STROKE_WIDTH}
                                fill="none"
                            />
                            {/* Progress Circle */}
                            <AnimatedCircle
                                cx={CIRCLE_SIZE / 2}
                                cy={CIRCLE_SIZE / 2}
                                r={RADIUS}
                                stroke={getTimerColor()}
                                strokeWidth={STROKE_WIDTH}
                                fill="none"
                                strokeDasharray={CIRCUMFERENCE}
                                animatedProps={animatedProps}
                                strokeLinecap="round"
                                rotation="-90"
                                origin={`${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2}`}
                            />
                        </Svg>

                        {/* Countdown Text - Centered */}
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                            <Text
                                style={{
                                    fontSize: 70,
                                    fontWeight: '900',
                                    color: 'white',
                                    fontFamily: 'monospace',
                                    textAlign: 'center'
                                }}
                            >
                                {formatTime(timeLeft)}
                            </Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={{ alignItems: 'center', marginTop: 80, gap: 16 }}>
                        <TouchableOpacity
                            onPress={onSkip}
                            activeOpacity={0.8}
                            style={{
                                height: 64,
                                width: BUTTON_WIDTH,
                                backgroundColor: '#2563eb',
                                borderRadius: 16,
                                alignItems: 'center',
                                justifyContent: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 5
                            }}
                        >
                            <Text style={{ color: 'white', fontWeight: '900', fontSize: 16, letterSpacing: 2 }}>SKIP REST</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => onAddTime(30)}
                            activeOpacity={0.8}
                            style={{
                                height: 64,
                                width: BUTTON_WIDTH,
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.1)',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Add 30 Seconds</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};
