import axios, { AxiosInstance } from 'axios'
import { Candidate, SimulationSession, APIResponse } from '@/types'

export class APIClient {
  private client: AxiosInstance
  private baseURL: string

  constructor(baseURL: string = process.env.NEXT_PUBLIC_HUB_GATEWAY_URL || 'http://localhost:14001') {
    this.baseURL = baseURL
    this.client = axios.create({
      baseURL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY || 'demo-key'}`,
      },
    })
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health')
      return response.data.status === 'ok'
    } catch (error) {
      console.warn('Health check failed:', error)
      return false
    }
  }

  /**
   * Initialize a simulation session on Control Plane
   */
  async initializeSession(sessionData: {
    tenantId: string
    batchId: string
    examType: string
    scenario: string
  }): Promise<SimulationSession> {
    try {
      const response = await this.client.post('/sessions/initialize', sessionData)
      return response.data.data
    } catch (error: any) {
      console.warn('Failed to initialize session on Control Plane, using fallback:', error.message)
      // Return mock session for fallback
      return this.createMockSession()
    }
  }

  /**
   * Get candidate list for batch
   */
  async getCandidates(batchId: string): Promise<Candidate[]> {
    try {
      const response = await this.client.get(`/batches/${batchId}/candidates`)
      return response.data.data
    } catch (error: any) {
      console.warn('Failed to get candidates, using fallback:', error.message)
      return []
    }
  }

  /**
   * Inject violation for candidate
   */
  async injectViolation(sessionId: string, candidateId: string, violationType: string): Promise<{ success: boolean }> {
    try {
      const response = await this.client.post(`/sessions/${sessionId}/violations`, {
        candidateId,
        violationType,
        timestamp: Date.now(),
      })
      return response.data
    } catch (error: any) {
      console.warn('Failed to inject violation:', error.message)
      return { success: false }
    }
  }

  /**
   * Execute batch action (lock, pause, resume, etc.)
   */
  async executeBatchAction(
    sessionId: string,
    candidateIds: string[],
    action: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean }> {
    try {
      const response = await this.client.post(`/sessions/${sessionId}/batch-actions`, {
        candidateIds,
        action,
        metadata,
        timestamp: Date.now(),
      })
      return response.data
    } catch (error: any) {
      console.warn('Failed to execute batch action:', error.message)
      return { success: false }
    }
  }

  /**
   * Get analytics for session
   */
  async getAnalytics(sessionId: string): Promise<any> {
    try {
      const response = await this.client.get(`/sessions/${sessionId}/analytics`)
      return response.data.data
    } catch (error: any) {
      console.warn('Failed to get analytics:', error.message)
      return null
    }
  }

  /**
   * Run E2E tests
   */
  async runTests(): Promise<any[]> {
    try {
      const response = await this.client.post('/tests/run-e2e')
      return response.data.data || []
    } catch (error: any) {
      console.warn('Failed to run tests:', error.message)
      return []
    }
  }

  /**
   * Setup tenant on Control Plane
   */
  async setupTenantOnControlPlane(tenantName: string, tenantEmail: string): Promise<{ tenantId: string }> {
    try {
      const response = await this.client.post('/tenants/setup', {
        name: tenantName,
        email: tenantEmail,
        timestamp: Date.now(),
      })
      return response.data.data
    } catch (error: any) {
      console.warn('Failed to setup tenant, generating mock ID:', error.message)
      return { tenantId: `tenant_${Date.now()}` }
    }
  }

  /**
   * Create sessions on Control Plane for batch
   */
  async createSessionsOnControlPlane(
    tenantId: string,
    batchId: string,
    examType: string,
    scenario: string,
    tenantName?: string,
    candidates?: any[],
    examDurationSec?: number
  ): Promise<string> {
    try {
      const response = await this.client.post(`/api/v1/sessions`, {
        tenantId,
        tenantName,
        batchId,
        examType,
        scenario,
        candidates: candidates || [],
        examDurationSec,
        timestamp: Date.now(),
      })
      return response.data.sessionId || response.data.data?.sessionId
    } catch (error: any) {
      console.warn('Failed to create sessions, generating mock ID:', error.message)
      return `session_${Date.now()}`
    }
  }

  /**
   * Update session violations and candidates on Control Plane
   */
  async updateSessionViolations(
    sessionId: string,
    violations?: any[],
    candidates?: any[]
  ): Promise<{ success: boolean }> {
    try {
      const response = await this.client.post(`/api/v1/sessions/${sessionId}/violations`, {
        violations,
        candidates,
        timestamp: Date.now(),
      })
      return { success: response.data.success !== false }
    } catch (error: any) {
      console.warn('Failed to update session violations:', error.message)
      return { success: false }
    }
  }

  /**
   * Update session lifecycle status (active, submitted, time_expired, etc.)
   */
  async updateSessionStatus(
    sessionId: string,
    status: string,
    reason?: string,
    candidates?: any[]
  ): Promise<{ success: boolean }> {
    try {
      const response = await this.client.post(`/api/v1/sessions/${sessionId}/status`, {
        status,
        reason,
        candidates,
        timestamp: Date.now(),
      })
      return { success: response.data.success !== false }
    } catch (error: any) {
      console.warn('Failed to update session status:', error.message)
      return { success: false }
    }
  }

  /**
   * Check whether a session currently exists in gateway store
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    try {
      const response = await this.client.get(`/api/v1/sessions/${sessionId}`)
      return !!response.data?.success
    } catch {
      return false
    }
  }

  /**
   * Create mock session for fallback
   */
  private createMockSession(): SimulationSession {
    return {
      id: `session_${Date.now()}`,
      tenantId: `tenant_${Date.now()}`,
      tenantName: 'Demo Tenant',
      tenantEmail: 'demo@acme.com',
      batchId: 'batch-1',
      examType: 'engineering',
      scenario: 'realistic',
      candidates: [],
      startedAt: Date.now(),
      updatedAt: Date.now(),
      cohortStats: {
        meanScore: 75,
        stdDev: 10,
        totalViolations: 0,
        alertsTriggered: 0,
      },
    }
  }
}

// Create singleton instance
export const apiClient = new APIClient(process.env.NEXT_PUBLIC_HUB_GATEWAY_URL || 'http://localhost:14001')
