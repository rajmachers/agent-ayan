import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
app.use(helmet()); app.use(cors()); app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'hub-ai-behavior' }));

app.post('/api/analyze/behavior', async (req, res) => {
  try {
    const { sessionId, poseData, gazeData, spokeId } = req.body;
    // TODO: Import MediaPipe behavior analysis from agent-proctor main
    res.json({
      sessionId,
      spokeId: spokeId || 'edutech',
      timestamp: new Date().toISOString(),
      focusScore: 0.85,
      postureStability: 0.9,
      suspiciousMovements: [],
      riskLevel: 'low',
      violations: [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Behavior analysis failed' });
  }
});

app.listen(PORT, () => console.log(`[hub-ai-behavior] listening on :${PORT}`));
export default app;
