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
    target_muscle?: string | null;
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
  const [isTechExpanded, setIsTechExpanded] = React.useState(false);

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

  const TechnicalRow = ({ label, value }: { label: string, value?: string | null }) => {
    if (!value) return null;
    return (
      <View className="flex-row items-center justify-between py-2 border-b border-gray-800/30">
        <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider">{label}</Text>
        <Text className="text-white text-sm font-semibold">{value}</Text>
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

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}>

          {/* Media Section - Hero */}
          <MediaSection />

          {/* Execution Cues - Prime real estate */}
          <View className="mt-8">
            <View className="flex-row items-center mb-4 px-1">
              <View className="w-8 h-8 rounded-xl bg-orange-500/10 items-center justify-center mr-3">
                <Ionicons name="flash" size={18} color="#f97316" />
              </View>
              <Text className="text-xl font-black text-white">Execution Cues</Text>
            </View>

            <View className="bg-gray-900/40 rounded-[28px] p-2 border border-blue-500/5">
              {(exercise.instructions || exercise.tips) ? (
                [...(exercise.instructions || []), ...(exercise.tips || [])].slice(0, 3).map((step, i) => (
                  <View key={i} className={`flex-row p-4 ${i !== 2 ? 'border-b border-gray-800/40' : ''}`}>
                    <View className="w-6 h-6 rounded-full bg-blue-600/10 items-center justify-center mr-4 mt-1 border border-blue-500/10">
                      <Text className="text-blue-400 text-[10px] font-bold">{i + 1}</Text>
                    </View>
                    <Text className="text-base text-gray-300 flex-1 leading-relaxed">{step}</Text>
                  </View>
                ))
              ) : (
                <View className="p-8 items-center">
                  <Text className="text-gray-500 italic">No cues available yet</Text>
                </View>
              )}
            </View>
          </View>

          {/* Muscle Focus */}
          <View className="mt-8 px-1">
            <Text className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-4">Muscle Focus</Text>

            <View className="flex-row items-center">
              <View className="bg-blue-600/20 px-4 py-2 rounded-2xl border border-blue-500/30 mr-3">
                <Text className="text-blue-400 text-[11px] font-black uppercase tracking-wider">
                  Primary: {exercise.target_muscle || exercise.muscle_groups?.[0] || 'Target'}
                </Text>
              </View>

              {exercise.muscle_groups && exercise.muscle_groups.length > (exercise.target_muscle ? 0 : 1) && (
                <Text className="text-gray-500 text-xs italic flex-1" numberOfLines={1}>
                  + {exercise.muscle_groups.filter(m => m !== (exercise.target_muscle || exercise.muscle_groups?.[0])).slice(0, 2).join(', ')}
                </Text>
              )}
            </View>
          </View>

          {/* Technical Data - Collapsible footer */}
          <View className="mt-12 pt-8 border-t border-gray-900">
            <Pressable
              onPress={() => setIsTechExpanded(!isTechExpanded)}
              className="flex-row items-center justify-between px-1 mb-4"
            >
              <View className="flex-row items-center">
                <Ionicons name="settings-outline" size={14} color="#4b5563" />
                <Text className="text-gray-600 font-bold text-[10px] uppercase tracking-[2px] ml-2">Technical Data</Text>
              </View>
              <Ionicons name={isTechExpanded ? "chevron-up" : "chevron-down"} size={16} color="#4b5563" />
            </Pressable>

            {isTechExpanded && (
              <View className="bg-gray-900/20 rounded-2xl p-4 space-y-1">
                <TechnicalRow label="Movement" value={exercise.movement_type} />
                <TechnicalRow label="Type" value={exercise.mechanics} />
                <TechnicalRow label="Posture" value={exercise.posture} />
                <TechnicalRow label="Equipment" value={exercise.equipment_needed?.join(', ')} />
              </View>
            )}
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
}
