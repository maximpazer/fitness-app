import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import React, { useRef } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ExerciseVideoModalProps {
  exercise: {
    name: string;
    video_url?: string | null;
    gif_url?: string | null;
    image_url?: string | null;
    instructions?: string[] | null;
    tips?: string[] | null;
    muscle_groups?: string[] | null;
    equipment_needed?: string[] | null;
  } | null;
  visible: boolean;
  onClose: () => void;
}

export function ExerciseVideoModal({ exercise, visible, onClose }: ExerciseVideoModalProps) {
  const insets = useSafeAreaInsets();
  const videoRef = useRef<Video>(null);

  if (!exercise) return null;

  const hasVideo = !!exercise.video_url;
  const hasGif = !!exercise.gif_url;
  const hasImage = !!exercise.image_url;
  const hasInstructions = exercise.instructions && exercise.instructions.length > 0;
  const hasTips = exercise.tips && exercise.tips.length > 0;
  const hasMuscleGroups = exercise.muscle_groups && exercise.muscle_groups.length > 0;
  const hasEquipment = exercise.equipment_needed && exercise.equipment_needed.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-gray-950" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-800">
          <Pressable
            onPress={onClose}
            className="w-10 h-10 items-center justify-center rounded-full bg-gray-800"
          >
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text className="text-lg font-bold text-white flex-1 text-center mr-10" numberOfLines={1}>
            {exercise.name}
          </Text>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          {/* Video Player */}
          {hasVideo && (
            <View className="mb-6 rounded-xl overflow-hidden bg-gray-900">
              <Video
                ref={videoRef}
                source={{ uri: exercise.video_url! }}
                shouldPlay
                isLooping
                isMuted
                resizeMode={ResizeMode.COVER}
                style={{ width: '100%', aspectRatio: 1 }}
              />
            </View>
          )}

          {/* GIF Fallback */}
          {!hasVideo && hasGif && (
            <View className="mb-6 rounded-xl overflow-hidden bg-gray-900">
              <Image
                source={{ uri: exercise.gif_url! }}
                style={{ width: '100%', aspectRatio: 1 }}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Image Fallback */}
          {!hasVideo && !hasGif && hasImage && (
            <View className="mb-6 rounded-xl overflow-hidden bg-gray-900">
              <Image
                source={{ uri: exercise.image_url! }}
                style={{ width: '100%', aspectRatio: 1 }}
                resizeMode="cover"
              />
            </View>
          )}

          {/* No placeholder when no media - just show stats below */}

          {/* Muscle Groups & Equipment Tags */}
          {(hasMuscleGroups || hasEquipment) && (
            <View className="mb-6">
              <View className="flex-row flex-wrap gap-2">
                {hasMuscleGroups && exercise.muscle_groups!.map((muscle, i) => (
                  <View key={`muscle-${i}`} className="bg-blue-600/20 px-3 py-1.5 rounded-full">
                    <Text className="text-blue-400 text-sm font-medium capitalize">{muscle}</Text>
                  </View>
                ))}
                {hasEquipment && exercise.equipment_needed!.map((equip, i) => (
                  <View key={`equip-${i}`} className="bg-gray-800 px-3 py-1.5 rounded-full">
                    <Text className="text-gray-400 text-sm font-medium capitalize">{equip}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Instructions */}
          {hasInstructions && (
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <Ionicons name="list-outline" size={20} color="#3b82f6" />
                <Text className="text-lg font-bold text-white ml-2">Instructions</Text>
              </View>
              <View className="bg-gray-900 rounded-2xl p-4">
                {exercise.instructions!.map((step, i) => (
                  <View key={i} className="flex-row mb-3 last:mb-0">
                    <View className="w-6 h-6 rounded-full bg-blue-600 items-center justify-center mr-3 mt-0.5">
                      <Text className="text-white text-xs font-bold">{i + 1}</Text>
                    </View>
                    <Text className="text-base text-gray-300 flex-1">{step}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Tips */}
          {hasTips && (
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <Ionicons name="bulb-outline" size={20} color="#f59e0b" />
                <Text className="text-lg font-bold text-white ml-2">Pro Tips</Text>
              </View>
              <View className="bg-gray-900 rounded-2xl p-4">
                {exercise.tips!.map((tip, i) => (
                  <View key={i} className="flex-row mb-2 last:mb-0">
                    <Text className="text-amber-500 mr-2">•</Text>
                    <Text className="text-sm text-gray-400 flex-1">{tip}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* No content fallback */}
          {!hasInstructions && !hasTips && (
            <View className="bg-gray-900 rounded-2xl p-6 items-center">
              <Ionicons name="information-circle-outline" size={32} color="#6b7280" />
              <Text className="text-gray-500 text-center mt-2">
                No additional information available for this exercise.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Close Button at Bottom */}
        <View className="px-4 pb-4" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          <Pressable
            onPress={onClose}
            className="bg-gray-800 py-4 rounded-2xl items-center active:bg-gray-700"
          >
            <Text className="text-white font-bold text-base">Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
