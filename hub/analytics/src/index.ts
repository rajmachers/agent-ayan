import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
app.use(helmet()); app.use(cors()); app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'hub-analytics' }));

// ── Proctor Efficiency Metrics ──
app.get('/api/analytics/proctor-efficiency', async (req, res) => {
  try {
    const { organizationId, spokeId } = req.query;
    const result = await pool.query(`
      SELECT
        hd.proctor_id,
        COUNT(*) as total_decisions,
        AVG(EXTRACT(EPOCH FROM (hd.created_at - gq.requested_at))) as avg_response_seconds,
        COUNT(*) FILTER (WHERE hd.decision = 'approved') as approvals,
        COUNT(*) FILTER (WHERE hd.decision = 'denied') as denials
      FROM hub_human_decisions hd
      LEFT JOIN hub_gatekeeper_queue gq ON gq.session_id = hd.session_id
      LEFT JOIN hub_sessions s ON s.id = hd.session_id
      WHERE ($1::uuid IS NULL OR s.organization_id = $1::uuid)
        AND ($2::text IS NULL OR s.spoke_id = $2::text)
        AND hd.created_at > NOW() - INTERVAL '30 days'
      GROUP BY hd.proctor_id
    `, [organizationId || null, spokeId || null]);

    res.json({ period: '30d', proctors: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute proctor efficiency' });
  }
});

// ── Tenant Analytics (cross-spoke) ──
app.get('/api/analytics/tenant/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const sessions = await pool.query(
      `SELECT spoke_id, status, COUNT(*) as count
       FROM hub_sessions WHERE organization_id = $1
       GROUP BY spoke_id, status`,
      [organizationId]
    );
    const violations = await pool.query(
      `SELECT v.type, v.severity, COUNT(*) as count
       FROM hub_violations v
       JOIN hub_sessions s ON s.id = v.session_id
       WHERE s.organization_id = $1
       GROUP BY v.type, v.severity
       ORDER BY count DESC LIMIT 20`,
      [organizationId]
    );

    res.json({
      organizationId,
      sessionBreakdown: sessions.rows,
      topViolations: violations.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute tenant analytics' });
  }
});

app.listen(PORT, () => console.log(`[hub-analytics] listening on :${PORT}`));
export default app;
