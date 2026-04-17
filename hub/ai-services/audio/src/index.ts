import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
app.use(helmet()); app.use(cors()); app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'hub-ai-audio' }));

app.post('/api/analyze/audio', async (req, res) => {
  try {
    const { sessionId, audioChunk, spokeId } = req.body;
    // TODO: Import Whisper + speaker diarization from agent-proctor main
    res.json({
      sessionId,
      spokeId: spokeId || 'edutech',
      timestamp: new Date().toISOString(),
      speakerCount: 1,
      backgroundNoiseLevel: 'low',
      forbiddenKeywords: [],
      confidence: 0.88,
      violations: [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Audio analysis failed' });
  }
});

app.listen(PORT, () => console.log(`[hub-ai-audio] listening on :${PORT}`));
export default app;
