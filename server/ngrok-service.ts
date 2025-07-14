import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let ngrokProcess: any = null;
let ngrokDomain: string | null = null;

interface NgrokTunnel {
  name: string;
  proto: string;
  public_url: string;
  config: {
    addr: string;
  };
}

interface NgrokApiResponse {
  tunnels: NgrokTunnel[];
}

export async function startNgrokAndGetDomain(port: number = 5000): Promise<string | null> {
  try {
    console.log('🔗 Starting ngrok tunnel...');
    
    // Always check current tunnel status instead of using cached domain
    const currentDomain = await getNgrokDomain();
    if (currentDomain) {
      console.log(`✅ Ngrok already running: ${currentDomain}`);
      ngrokDomain = currentDomain; // Update cache
      return currentDomain;
    }

    // Start ngrok process
    ngrokProcess = spawn('./ngrok', ['http', port.toString()], {
      stdio: 'pipe',
      detached: false
    });

    // Handle ngrok process events
    ngrokProcess.on('error', (error: Error) => {
      console.error('❌ Ngrok process error:', error);
    });

    ngrokProcess.stdout?.on('data', (data: Buffer) => {
      console.log('Ngrok stdout:', data.toString());
    });

    ngrokProcess.stderr?.on('data', (data: Buffer) => {
      console.log('Ngrok stderr:', data.toString());
    });

    // Wait for ngrok to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get tunnel information from ngrok API
    const { stdout } = await execAsync('curl -s http://localhost:4040/api/tunnels');
    const response: NgrokApiResponse = JSON.parse(stdout);

    // Find HTTPS tunnel
    for (const tunnel of response.tunnels || []) {
      if (tunnel.proto === 'https') {
        const url = tunnel.public_url;
        ngrokDomain = url.replace(/https?:\/\//, '');
        console.log(`✅ Ngrok tunnel ready: ${ngrokDomain}`);
        return ngrokDomain;
      }
    }

    console.error('❌ No HTTPS tunnel found');
    return null;

  } catch (error) {
    console.error('❌ Error starting ngrok:', error);
    return null;
  }
}

export async function getNgrokDomain(): Promise<string | null> {
  try {
    // Always fetch current domain from ngrok API to avoid stale cache
    const { stdout } = await execAsync('curl -s http://localhost:4040/api/tunnels');
    const response: NgrokApiResponse = JSON.parse(stdout);
    
    // Find HTTPS tunnel
    for (const tunnel of response.tunnels || []) {
      if (tunnel.proto === 'https') {
        const url = tunnel.public_url;
        const currentDomain = url.replace(/https?:\/\//, '');
        ngrokDomain = currentDomain; // Update cache
        return currentDomain;
      }
    }
    
    return ngrokDomain; // Fallback to cached if API fails
  } catch (error) {
    console.error('Error fetching ngrok domain:', error);
    return ngrokDomain; // Fallback to cached
  }
}

export function stopNgrok(): void {
  if (ngrokProcess) {
    console.log('🛑 Stopping ngrok...');
    ngrokProcess.kill();
    ngrokProcess = null;
    ngrokDomain = null;
  }
}

// Cleanup on exit
process.on('exit', stopNgrok);
process.on('SIGINT', stopNgrok);
process.on('SIGTERM', stopNgrok);