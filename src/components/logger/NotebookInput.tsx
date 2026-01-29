import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NotebookInputProps {
    visible: boolean;
    value: string;
    label: string; // e.g. "Set 1 - Weight"
    onChange: (val: string) => void;
    onNext: () => void;
    onPrev: () => void;
    onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const NotebookInput: React.FC<NotebookInputProps> = ({
    visible,
    value,
    label,
    onChange,
    onNext,
    onPrev,
    onClose
}) => {
    const insets = useSafeAreaInsets();
    
    // Local state for instant display
    const [displayValue, setDisplayValue] = useState(value);
    
    // Sync displayValue when value prop changes (field navigation)
    useEffect(() => {
        setDisplayValue(value);
    }, [value]);
    
    if (!visible) return null;

    const handlePress = useCallback((key: string) => {
        Haptics.selectionAsync();
        let newValue: string;
        
        if (key === 'backspace') {
            newValue = displayValue.slice(0, -1);
        } else if (key === '.') {
            if (!displayValue.includes('.')) {
                newValue = displayValue === '' ? '0.' : displayValue + '.';
            } else {
                return; // Already has decimal
            }
        } else {
            if (displayValue.length < 8) {
                newValue = displayValue === '0' ? key : displayValue + key;
            } else {
                return; // Max length
            }
        }
        
        setDisplayValue(newValue); // Instant UI update
        onChange(newValue); // Notify parent
    }, [displayValue, onChange]);

    const adjust = useCallback((delta: number) => {
        Haptics.selectionAsync();
        const num = parseFloat(displayValue) || 0;
        const next = Math.max(0, num + delta);
        const nextStr = next % 1 === 0 ? next.toString() : next.toFixed(1);
        
        setDisplayValue(nextStr); // Instant UI update
        onChange(nextStr); // Notify parent
    }, [displayValue, onChange]);

    const keys = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['.', '0', 'backspace']
    ];

    return (
        <View
            style={[
                styles.container,
                { paddingBottom: Math.max(insets.bottom, 20) }
            ]}
        >
            <TouchableOpacity
                onPress={onClose}
                style={styles.hideButton}
            >
                <Ionicons name="chevron-down" size={18} color="#6b7280" />
            </TouchableOpacity>

            {/* Header Removed (Preview redundant) */}

            <View style={styles.padBody}>
                {/* Numeric Grid */}
                <View style={styles.gridColumn}>
                    {keys.map((row, i) => (
                        <View key={i} style={styles.gridRow}>
                            {row.map((key) => (
                                <TouchableOpacity
                                    key={key}
                                    onPress={() => handlePress(key)}
                                    style={styles.keyButton}
                                >
                                    {key === 'backspace' ? (
                                        <Ionicons name="backspace" size={24} color="#ef4444" />
                                    ) : (
                                        <Text style={styles.keyText}>{key}</Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    ))}
                </View>

                {/* Vertical Control Strip */}
                <View style={styles.controlColumn}>
                    <TouchableOpacity
                        onPress={() => adjust(2.5)}
                        style={[styles.controlButton, styles.stepper25]}
                    >
                        <Text style={styles.stepper25Text}>+2.5</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => adjust(1)}
                        style={[styles.controlButton, styles.stepperBlue]}
                    >
                        <Ionicons name="add" size={28} color="#3b82f6" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => adjust(-1)}
                        style={styles.controlButton}
                    >
                        <Ionicons name="remove" size={28} color="#9ca3af" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onNext}
                        style={[styles.nextButtonContainer]}
                    >
                        <View style={[styles.navButton, styles.nextButton, { height: 56, width: '100%' }]}>
                            <Ionicons name="arrow-forward" size={24} color="white" />
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1f2937',
        borderTopWidth: 1,
        borderTopColor: '#374151',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 20,
        width: '100%',
    },
    padBody: {
        flexDirection: 'row',
        padding: 16,
    },
    gridColumn: {
        flex: 3,
        gap: 8,
    },
    gridRow: {
        flexDirection: 'row',
        gap: 8,
    },
    keyButton: {
        flex: 1,
        height: 56,
        backgroundColor: '#374151',
        borderWidth: 1,
        borderColor: '#4b5563',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    keyText: {
        color: '#f3f4f6',
        fontSize: 24,
        fontWeight: 'bold',
    },
    controlColumn: {
        flex: 1,
        marginLeft: 12,
        gap: 8,
    },
    controlButton: {
        flex: 1,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1f2937',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 56,
    },
    stepper25: {
        backgroundColor: 'rgba(234, 179, 8, 0.15)',
        borderColor: 'rgba(234, 179, 8, 0.4)',
    },
    stepper25Text: {
        color: '#eab308',
        fontWeight: '900',
    },
    stepperBlue: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: 'rgba(59, 130, 246, 0.4)',
    },
    nextButtonContainer: {
        marginTop: 'auto',
    },
    navButton: {
        backgroundColor: '#374151',
        borderWidth: 1,
        borderColor: '#4b5563',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextButton: {
        backgroundColor: '#3b82f6',
        borderColor: '#60a5fa',
    },
    hideButton: {
        position: 'absolute',
        top: 8,
        left: 20,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#374151',
        borderWidth: 1,
        borderColor: '#4b5563',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    }
});
