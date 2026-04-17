import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'hub-ai-vision' }));

// ── Frame Analysis ──
// Accepts base64-encoded frames from any spoke and returns violation analysis.
app.post('/api/analyze/frame', async (req, res) => {
  try {
    const { sessionId, frameData, spokeId } = req.body;
    if (!frameData) return res.status(400).json({ error: 'frameData required' });

    // TODO: Replace with actual OpenCV/TensorFlow processing from agent-proctor main
    const analysis = {
      sessionId,
      spokeId: spokeId || 'edutech',
      timestamp: new Date().toISOString(),
      faceDetected: true,
      faceCount: 1,
      gazeDirection: 'center',
      objectsDetected: [],
      confidenceScore: 0.95,
      violations: [],
      complexityScore: 0,
      escalationRequired: false,
    };

    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: 'Vision analysis failed' });
  }
});

// ── Face Verification ──
app.post('/api/verify/face', async (req, res) => {
  try {
    const { referenceImage, candidateFrame } = req.body;
    // TODO: Import face-matching logic from agent-proctor main
    res.json({
      match: true,
      confidence: 0.92,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Face verification failed' });
  }
});

app.listen(PORT, () => {
  console.log(`[hub-ai-vision] listening on :${PORT}`);
});

export default app;
