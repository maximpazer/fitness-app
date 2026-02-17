
import 'dotenv/config';
import { aiToolsService } from '../src/services/ai-tools.service';

async function test() {
    console.log('🔍 Testing "calisthenics" search...');

    // Test 1: Broad search (what the AI was likely doing)
    console.log('\n--- Test 1: Broad search (No equipment filter) ---');
    const results1 = await aiToolsService.searchExercisesSemantic({
        query: "calisthenics"
    });

    if ('results' in results1) {
        results1.results.slice(0, 5).forEach((ex: any) => {
            console.log(`- ${ex.name} (Score: ${ex.match_score}) [${ex.equipment.join(', ')}]`);
        });
    }

    // Test 2: Specific search (what we want the AI to do now)
    console.log('\n--- Test 2: Specific search (Equipment: Bodyweight) ---');
    const results2 = await aiToolsService.searchExercisesSemantic({
        query: "beginner calisthenics",
        equipment: ["Bodyweight"]
    });

    if ('results' in results2) {
        results2.results.slice(0, 5).forEach((ex: any) => {
            console.log(`- ${ex.name} (Score: ${ex.match_score}) [${ex.equipment.join(', ')}]`);
        });
    }
}

test();
