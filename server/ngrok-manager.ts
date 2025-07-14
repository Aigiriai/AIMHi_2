interface NgrokTunnel {
  public_url: string;
  proto: string;
}

interface NgrokResponse {
  tunnels: NgrokTunnel[];
}

export class NgrokManager {
  private currentDomain: string | null = null;

  async getTunnelDomain(): Promise<string> {
    try {
      // First try to get domain from environment variable (if managed externally)
      const envDomain = process.env.NGROK_DOMAIN;
      if (envDomain) {
        console.log(`Using ngrok domain from environment: ${envDomain}`);
        this.currentDomain = envDomain;
        return envDomain;
      }

      // Try to get domain from ngrok API if running locally
      const response = await fetch('http://127.0.0.1:4040/api/tunnels');
      if (!response.ok) {
        throw new Error(`Ngrok API returned ${response.status}`);
      }

      const data: NgrokResponse = await response.json();
      
      if (!data.tunnels || data.tunnels.length === 0) {
        throw new Error('No active tunnels found');
      }

      // Find HTTPS tunnel
      const httpsTunnel = data.tunnels.find(tunnel => tunnel.proto === 'https');
      if (httpsTunnel) {
        const domain = httpsTunnel.public_url.replace('https://', '');
        this.currentDomain = domain;
        return domain;
      }

      // Fallback to first tunnel
      const firstTunnel = data.tunnels[0];
      const domain = firstTunnel.public_url.replace(/https?:\/\//, '');
      this.currentDomain = domain;
      return domain;

    } catch (error) {
      console.error('Failed to get tunnel domain:', error);
      // Fallback to localhost for local testing
      return 'localhost:5000';
    }
  }

  getCurrentDomain(): string | null {
    return this.currentDomain;
  }

  async ensureTunnelActive(): Promise<string> {
    return await this.getTunnelDomain();
  }
}

export const ngrokManager = new NgrokManager();