import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { NotebookInput } from './logger/NotebookInput';

interface WeightInputModalProps {
  visible: boolean;
  initialValue: string;
  onSave: (val: string) => void;
  onClose: () => void;
}

export const WeightInputModal: React.FC<WeightInputModalProps> = ({
  visible,
  initialValue,
  onSave,
  onClose
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue, visible]);

  const handleSave = useCallback(() => {
    onSave(value);
    onClose();
  }, [value, onSave, onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="bg-gray-900 rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white font-bold text-xl">Log Weight</Text>
              <TouchableOpacity onPress={onClose}>
                <Text className="text-gray-400 text-2xl">×</Text>
              </TouchableOpacity>
            </View>
            <NotebookInput
              visible={true}
              value={value}
              label={"Weight (kg)"}
              onChange={setValue}
              onNext={handleSave}
              onPrev={() => {}}
              onClose={onClose}
            />
            <TouchableOpacity
              className="bg-blue-600 py-4 rounded-full mt-6"
              onPress={handleSave}
            >
              <Text className="text-white font-bold text-center text-lg">Save Weight</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};
