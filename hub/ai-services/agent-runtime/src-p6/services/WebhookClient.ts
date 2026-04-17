import axios from 'axios';
import { WebhookPayload } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

export class WebhookClient {
  private readonly apiGatewayUrl: string;

  constructor() {
    this.apiGatewayUrl = config.apiGateway.url;
  }

  async sendViolationEvent(payload: WebhookPayload): Promise<void> {
    try {
      await this.sendWebhook('/api/v1/webhooks/ai', {
        event: 'violation_detected',
        sessionId: payload.session_id,
        component: 'agent-runtime',
        timestamp: payload.timestamp,
        data: {
          agent_id: payload.agent_id,
          ...payload.data,
        },
      });

      logger.debug('Violation webhook sent', {
        sessionId: payload.session_id,
        agentId: payload.agent_id,
        event: payload.event,
      });
    } catch (error) {
      logger.error('Failed to send violation webhook', {
        sessionId: payload.session_id,
        agentId: payload.agent_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async sendSessionEvent(payload: WebhookPayload): Promise<void> {
    try {
      await this.sendWebhook('/api/v1/webhooks/ai', {
        event: payload.event,
        sessionId: payload.session_id,
        component: 'agent-runtime',
        timestamp: payload.timestamp,
        data: {
          agent_id: payload.agent_id,
          ...payload.data,
        },
      });

      logger.info('Session event webhook sent', {
        sessionId: payload.session_id,
        agentId: payload.agent_id,
        event: payload.event,
      });
    } catch (error) {
      logger.error('Failed to send session webhook', {
        sessionId: payload.session_id,
        agentId: payload.agent_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async sendScoreUpdate(
    sessionId: string,
    agentId: string,
    score: number,
    breakdown: Record<string, number>
  ): Promise<void> {
    try {
      await this.sendWebhook('/api/v1/webhooks/ai', {
        event: 'score_updated',
        sessionId,
        component: 'agent-runtime',
        timestamp: Date.now(),
        data: {
          agent_id: agentId,
          score,
          breakdown,
        },
      });

      logger.debug('Score update webhook sent', {
        sessionId,
        agentId,
        score,
      });
    } catch (error) {
      logger.error('Failed to send score update webhook', {
        sessionId,
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async sendWebhook(endpoint: string, payload: any): Promise<void> {
    const url = `${this.apiGatewayUrl}${endpoint}`;
    
    const response = await axios.post(url, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'agent-runtime',
        'X-Webhook-Signature': this.generateSignature(payload),
        'X-Webhook-Timestamp': Date.now().toString(),
      },
    });

    if (response.status >= 400) {
      throw new Error(`Webhook failed with status ${response.status}`);
    }
  }

  private generateSignature(payload: any): string {
    // In production, this would generate an HMAC signature
    // For now, return a placeholder
    return 'sha256=' + Buffer.from(JSON.stringify(payload)).toString('base64').slice(0, 32);
  }
}