const googleTTS = require('google-tts-api'); // https://www.npmjs.com/package/google-tts-api
const fs = require('fs');
const path = require('path');
const https = require('https');

const LESSONS_DIR = path.join(__dirname, 'lessons');
const PUBLIC_DIR = path.join(__dirname, 'public');
const AUDIO_DIR = path.join(PUBLIC_DIR, 'audio');

// Ensure base audio directory exists
if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// Function to sanitize text for filenames
function sanitize(text) {
    return text.toString().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents for filename
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 50);
}

// Function to download audio
async function downloadAudio(text, filepath) {
    if (fs.existsSync(filepath)) {
        // console.log(`⏩ Skip: ${text}`);
        return;
    }

    try {
        const url = googleTTS.getAudioUrl(text, {
            lang: 'ro',
            slow: false,
            host: 'https://translate.google.com',
        });

        // Use https.get to download file
        await new Promise((resolve, reject) => {
            https.get(url, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Status ${res.statusCode}`));
                    return;
                }
                const file = fs.createWriteStream(filepath);
                res.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`✅ Saved: "${text}" -> ${path.basename(filepath)}`);
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(filepath, () => { }); // delete incomplete file
                reject(err);
            });
        });

        // Sleep to avoid rate limits
        await new Promise(r => setTimeout(r, 500));

    } catch (err) {
        console.error(`❌ Error downloading "${text}":`, err.message);
    }
}

async function processLessons() {
    console.log('🎤 Generating audio for lessons...');

    const files = fs.readdirSync(LESSONS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));

    for (const file of files) {
        try {
            const lessonData = JSON.parse(fs.readFileSync(path.join(LESSONS_DIR, file), 'utf-8'));
            const lessonId = lessonData.id;
            const lessonAudioDir = path.join(AUDIO_DIR, lessonId); // /public/audio/<lesson-id>/

            if (!fs.existsSync(lessonAudioDir)) {
                fs.mkdirSync(lessonAudioDir, { recursive: true });
            }

            console.log(`\n--- Lesson: ${lessonData.title} ---`);

            // 1. Vocabulary
            if (lessonData.vocabulary) {
                for (const v of lessonData.vocabulary) {
                    if (v.romanian) {
                        const filename = `${sanitize(v.romanian)}.mp3`;
                        await downloadAudio(v.romanian, path.join(lessonAudioDir, filename));
                    }
                }
            }

            // 2. Exercises (Pre-K Listen & Select prompts)
            if (lessonData.exercises) {
                for (const ex of lessonData.exercises) {
                    if (ex.type === 'listen_and_select' && ex.prompt) {
                        // Use prompt text for filename
                        const filename = `${sanitize(ex.prompt)}.mp3`;
                        await downloadAudio(ex.prompt, path.join(lessonAudioDir, filename));
                    }
                }
            }

        } catch (err) {
            console.error(`Error reading ${file}:`, err);
        }
    }
    console.log('\n🎉 Finished generating audio files!');
}

processLessons();
