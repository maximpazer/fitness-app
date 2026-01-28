// ExerciseDB API Service (via RapidAPI)
// API: exercise-db-with-videos-and-images-by-ascendapi

const BASE_URL = 'https://exercise-db-with-videos-and-images-by-ascendapi.p.rapidapi.com/api/v1';

const getHeaders = () => ({
  'x-rapidapi-host': process.env.EXPO_PUBLIC_RAPIDAPI_HOST || '',
  'x-rapidapi-key': process.env.EXPO_PUBLIC_RAPIDAPI_KEY || '',
});

export interface ExerciseDBResult {
  exerciseId: string;
  name: string;
  description?: string;
  category?: string;
  bodyParts?: string[];
  targetMuscles?: string[];
  equipments?: string[];
  imageUrl?: string;
  videoUrl?: string;
  gifUrl?: string;
  instructions?: string[];
  exerciseTips?: string[];
}

export interface ExerciseDBSearchResponse {
  success: boolean;
  data: ExerciseDBResult[];
}

export interface ExerciseDBDetailResponse {
  success: boolean;
  data: ExerciseDBResult;
}

/**
 * Search exercises by query string
 */
export async function searchExercises(query: string): Promise<ExerciseDBSearchResponse> {
  const res = await fetch(`${BASE_URL}/exercises/search?search=${encodeURIComponent(query)}`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error(`ExerciseDB API error: ${res.status}`);
  }
  
  return res.json();
}

/**
 * Get detailed exercise information by ExerciseDB ID
 */
export async function getExerciseDetail(exerciseDbId: string): Promise<ExerciseDBDetailResponse> {
  const res = await fetch(`${BASE_URL}/exercises/${exerciseDbId}`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error(`ExerciseDB API error: ${res.status}`);
  }
  
  return res.json();
}

/**
 * Get exercises by body part
 */
export async function getExercisesByBodyPart(bodyPart: string): Promise<ExerciseDBSearchResponse> {
  const res = await fetch(`${BASE_URL}/exercises/body-part/${encodeURIComponent(bodyPart)}`, {
    headers: getHeaders(),
  });
  
  if (!res.ok) {
    throw new Error(`ExerciseDB API error: ${res.status}`);
  }
  
  return res.json();
}
