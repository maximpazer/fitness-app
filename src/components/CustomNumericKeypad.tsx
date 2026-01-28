import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CustomNumericKeypadProps {
    onNumberPress: (num: string) => void;
    onBackspace: () => void;
    onNext: () => void;
    onPlusMinus: () => void;
    onIncrement: () => void;
    onDecrement: () => void;
    showDecimal?: boolean;
}

export const CustomNumericKeypad: React.FC<CustomNumericKeypadProps> = ({
    onNumberPress,
    onBackspace,
    onNext,
    onPlusMinus,
    onIncrement,
    onDecrement,
    showDecimal = true
}) => {
    const insets = useSafeAreaInsets();

    const Button = ({ label, onPress, className = "", textClassName = "" }: any) => (
        <TouchableOpacity
            onPress={onPress}
            className={`flex-1 h-16 items-center justify-center ${className}`}
            activeOpacity={0.7}
        >
            <Text className={`text-white text-3xl font-semibold ${textClassName}`}>{label}</Text>
        </TouchableOpacity>
    );

    const IconButton = ({ icon, onPress, className = "" }: any) => (
        <TouchableOpacity
            onPress={onPress}
            className={`flex-1 h-16 items-center justify-center ${className}`}
            activeOpacity={0.7}
        >
            <Ionicons name={icon} size={32} color="white" />
        </TouchableOpacity>
    );

    return (
        <View className="bg-gray-900 border-t border-gray-700" style={{ paddingBottom: insets.bottom }}>
            {/* Row 1 */}
            <View className="flex-row border-b border-gray-800">
                <Button label="1" onPress={() => onNumberPress('1')} className="border-r border-gray-800" />
                <Button label="2" onPress={() => onNumberPress('2')} className="border-r border-gray-800" />
                <Button label="3" onPress={() => onNumberPress('3')} className="border-r border-gray-800" />
                <View className="flex-1 bg-gray-800 border-l border-gray-700" />
            </View>

            {/* Row 2 */}
            <View className="flex-row border-b border-gray-800">
                <Button label="4" onPress={() => onNumberPress('4')} className="border-r border-gray-800" />
                <Button label="5" onPress={() => onNumberPress('5')} className="border-r border-gray-800" />
                <Button label="6" onPress={() => onNumberPress('6')} className="border-r border-gray-800" />
                <IconButton icon="swap-horizontal" onPress={onPlusMinus} className="bg-gray-800 border-l border-gray-700" />
            </View>

            {/* Row 3 */}
            <View className="flex-row border-b border-gray-800">
                <Button label="7" onPress={() => onNumberPress('7')} className="border-r border-gray-800" />
                <Button label="8" onPress={() => onNumberPress('8')} className="border-r border-gray-800" />
                <Button label="9" onPress={() => onNumberPress('9')} className="border-r border-gray-800" />
                <View className="flex-1 flex-col border-l border-gray-700 bg-gray-800">
                    <TouchableOpacity
                        onPress={onIncrement}
                        className="flex-1 h-8 items-center justify-center border-b border-gray-700"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="add" size={28} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={onDecrement}
                        className="flex-1 h-8 items-center justify-center"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="remove" size={28} color="white" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Row 4 */}
            <View className="flex-row">
                {showDecimal ? (
                    <Button label="." onPress={() => onNumberPress('.')} className="border-r border-gray-800" />
                ) : (
                    <View className="flex-1 h-16 border-r border-gray-800" />
                )}
                <Button label="0" onPress={() => onNumberPress('0')} className="border-r border-gray-800" />
                <IconButton icon="backspace-outline" onPress={onBackspace} className="border-r border-gray-800" />
                <TouchableOpacity
                    onPress={onNext}
                    className="flex-1 h-16 items-center justify-center bg-blue-600"
                    activeOpacity={0.8}
                >
                    <Text className="text-white text-xl font-bold">Next</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};
