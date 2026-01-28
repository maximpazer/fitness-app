import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import YoutubePlayer from 'react-native-youtube-iframe';

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
    classification?: string | null;
    mechanics?: string | null;
    movement_type?: string | null;
    posture?: string | null;
    grip?: string | null;
    load_position?: string | null;
    laterality?: string | null;
    force_type?: string | null;
  } | null;
  visible: boolean;
  onClose: () => void;
}

const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export function ExerciseVideoModal({ exercise, visible, onClose }: ExerciseVideoModalProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;

  if (!exercise) return null;

  const hasVideo = !!exercise.video_url;
  const hasGif = !!exercise.gif_url;
  const hasImage = !!exercise.image_url;
  const hasInstructions = exercise.instructions && exercise.instructions.length > 0;
  const hasMuscleGroups = exercise.muscle_groups && exercise.muscle_groups.length > 0;
  const hasEquipment = exercise.equipment_needed && exercise.equipment_needed.length > 0;

  // Filter out technical metadata from tips if they are already in columns
  const metaKeys = ['classification', 'mechanics', 'movement', 'posture', 'grip', 'load', 'laterality', 'force'];
  const filteredTips = (exercise.tips || []).filter(tip => {
    const lowerTip = tip.toLowerCase();
    return !metaKeys.some(key => lowerTip.startsWith(`${key}:`));
  });
  const hasTips = filteredTips.length > 0;

  const TechBadge = ({ label, value }: { label: string, value?: string | null }) => {
    if (!value) return null;
    return (
      <View className="mb-4 w-1/2 pr-2">
        <Text className="text-gray-600 text-[10px] uppercase font-bold tracking-tighter mb-0.5">{label}</Text>
        <Text className="text-gray-200 text-sm font-semibold">{value}</Text>
      </View>
    );
  };

  const MediaSection = () => {
    const youtubeId = exercise.video_url ? getYoutubeId(exercise.video_url) : null;

    return (
      <View className={`${isLargeScreen ? 'w-full' : 'mb-6'}`}>
        {hasVideo && youtubeId ? (
          <View className="rounded-3xl overflow-hidden bg-black shadow-2xl border border-gray-800" style={{ aspectRatio: 16 / 9 }}>
            <YoutubePlayer
              height={isLargeScreen ? width * 0.45 : 220} // Adjusting height for standard 16:9 look
              play={visible}
              videoId={youtubeId}
            />
          </View>
        ) : hasVideo ? (
          <View className="rounded-3xl bg-gray-900/50 p-12 items-center border border-gray-800 border-dashed" style={{ aspectRatio: 16 / 9 }}>
            <Ionicons name="link-outline" size={32} color="#3b82f6" />
            <Text className="text-gray-400 text-center mt-3 font-medium">External Video Link</Text>
            <Text className="text-blue-400 text-xs text-center mt-1" numberOfLines={1}>{exercise.video_url}</Text>
          </View>
        ) : hasGif ? (
          <View className="rounded-3xl overflow-hidden bg-gray-900 shadow-xl" style={{ aspectRatio: 16 / 9 }}>
            <Image
              source={{ uri: exercise.gif_url! }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
        ) : hasImage ? (
          <View className="rounded-3xl overflow-hidden bg-gray-900 shadow-xl" style={{ aspectRatio: 16 / 9 }}>
            <Image
              source={{ uri: exercise.image_url! }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
        ) : (
          <View className="rounded-3xl bg-gray-900 p-12 items-center justify-center border border-gray-800" style={{ aspectRatio: 16 / 9 }}>
            <Ionicons name="image-outline" size={48} color="#374151" />
            <Text className="text-gray-600 mt-2">No preview available</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-gray-950" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-900 bg-gray-950/80">
          <Pressable onPress={onClose} className="w-10 h-10 items-center justify-center rounded-2xl bg-gray-900 border border-gray-800">
            <Ionicons name="close" size={20} color="#9ca3af" />
          </Pressable>
          <Text className="text-xl font-black text-white flex-1 text-center truncate mx-4">
            {exercise.name}
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 100 }}>
          <View className={isLargeScreen ? 'flex-row gap-8' : 'flex-col'}>

            {/* Left/Top: Media Section */}
            <View className={isLargeScreen ? 'flex-1' : 'w-full'}>
              <MediaSection />
            </View>

            {/* Right/Bottom: Technical Context, Instructions & Tips */}
            <View className={isLargeScreen ? 'flex-1' : 'mt-8 w-full'}>
              <View className="mb-8 bg-gray-900/30 border border-gray-800/50 rounded-[32px] p-6">
                <View className="flex-row items-center mb-6">
                  <View className="w-8 h-8 rounded-xl bg-blue-500/10 items-center justify-center mr-3">
                    <Ionicons name="settings-outline" size={16} color="#3b82f6" />
                  </View>
                  <Text className="text-gray-400 font-bold text-xs uppercase tracking-[2px]">Technical Context</Text>
                </View>

                <View className="flex-row flex-wrap">
                  <TechBadge label="Classification" value={exercise.classification} />
                  <TechBadge label="Mechanics" value={exercise.mechanics} />
                  <TechBadge label="Movement" value={exercise.movement_type} />
                  <TechBadge label="Posture" value={exercise.posture} />
                  <TechBadge label="Grip" value={exercise.grip} />
                  <TechBadge label="Force" value={exercise.force_type} />
                </View>

                {(hasMuscleGroups || hasEquipment) && (
                  <View className="mt-2 pt-6 border-t border-gray-800/50 flex-row flex-wrap gap-2">
                    {hasMuscleGroups && exercise.muscle_groups!.map((muscle, i) => (
                      <View key={`muscle-${i}`} className="bg-blue-600/10 px-3 py-1.5 rounded-xl border border-blue-500/20">
                        <Text className="text-blue-400 text-[10px] font-black uppercase tracking-wider">{muscle}</Text>
                      </View>
                    ))}
                    {hasEquipment && exercise.equipment_needed!.map((equip, i) => (
                      <View key={`equip-${i}`} className="bg-gray-800/50 px-3 py-1.5 rounded-xl border border-gray-700/50">
                        <Text className="text-gray-400 text-[10px] font-black uppercase tracking-wider">{equip}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              {hasInstructions && (
                <View className="mb-8">
                  <View className="flex-row items-center mb-4 px-2">
                    <Ionicons name="list" size={20} color="#3b82f6" />
                    <Text className="text-xl font-bold text-white ml-3">Instructions</Text>
                  </View>
                  <View className="bg-gray-900/50 rounded-[32px] p-2 border border-gray-900">
                    {exercise.instructions!.map((step, i) => (
                      <View key={i} className={`flex-row p-4 ${i !== exercise.instructions!.length - 1 ? 'border-b border-gray-900' : ''}`}>
                        <View className="w-8 h-8 rounded-full bg-blue-600/20 items-center justify-center mr-4 mt-1 border border-blue-500/20">
                          <Text className="text-blue-400 text-xs font-black">{i + 1}</Text>
                        </View>
                        <Text className="text-base text-gray-300 flex-1 leading-relaxed">{step}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {hasTips && (
                <View>
                  <View className="flex-row items-center mb-4 px-2">
                    <Ionicons name="sparkles" size={20} color="#f59e0b" />
                    <Text className="text-xl font-bold text-white ml-3">Pro Tips</Text>
                  </View>
                  <View className="bg-gray-900/50 rounded-[32px] p-6 border border-gray-900">
                    {filteredTips.map((tip, i) => (
                      <View key={i} className="flex-row mb-4 last:mb-0">
                        <View className="w-1.5 h-1.5 rounded-full bg-amber-500/50 mt-2 mr-3" />
                        <Text className="text-base text-gray-400 flex-1 leading-relaxed italic">{tip}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {!hasInstructions && !hasTips && (
                <View className="bg-gray-900/50 rounded-[32px] p-12 items-center border border-gray-900 border-dashed">
                  <Ionicons name="information-circle-outline" size={40} color="#374151" />
                  <Text className="text-gray-500 text-center mt-3 font-medium">Detailed guide coming soon</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
