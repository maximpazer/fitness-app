import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

type ConfirmDialogButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

type ConfirmDialogProps = {
    visible: boolean;
    title: string;
    message?: string;
    buttons: ConfirmDialogButton[];
    onClose: () => void;
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    visible,
    title,
    message,
    buttons,
    onClose
}) => {
    const handleButtonPress = (button: ConfirmDialogButton) => {
        if (button.onPress) {
            button.onPress();
        }
        onClose();
    };

    const getButtonStyle = (style?: string) => {
        switch (style) {
            case 'destructive':
                return 'bg-red-600';
            case 'cancel':
                return 'bg-gray-800';
            default:
                return 'bg-blue-600';
        }
    };

    const getButtonTextStyle = (style?: string) => {
        switch (style) {
            case 'cancel':
                return 'text-gray-300';
            default:
                return 'text-white';
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/70 justify-center items-center px-8">
                <View className="bg-gray-900 rounded-3xl w-full max-w-sm border border-gray-800 overflow-hidden">
                    {/* Header */}
                    <View className="p-6 pb-4">
                        <View className="flex-row items-center mb-3">
                            <View className="bg-blue-600/20 p-2.5 rounded-full mr-3">
                                <Ionicons name="information-circle" size={24} color="#3b82f6" />
                            </View>
                            <Text className="text-white font-bold text-xl flex-1">
                                {title}
                            </Text>
                        </View>
                        {message && (
                            <Text className="text-gray-400 text-base leading-6 ml-1">
                                {message}
                            </Text>
                        )}
                    </View>

                    {/* Buttons */}
                    <View className="p-4 pt-2 space-y-2">
                        {buttons.map((button, index) => {
                            const isCancel = button.style === 'cancel';
                            return (
                                <TouchableOpacity
                                    key={index}
                                    onPress={() => handleButtonPress(button)}
                                    className={`${getButtonStyle(button.style)} py-4 rounded-2xl ${isCancel ? 'border border-gray-700' : ''
                                        }`}
                                    activeOpacity={0.8}
                                >
                                    <Text
                                        className={`${getButtonTextStyle(button.style)} font-bold text-center text-base`}
                                    >
                                        {button.text}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </View>
        </Modal>
    );
};
