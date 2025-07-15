import { spawn, exec, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let pinggyProcess: ChildProcess | null = null;
let pinggyDomain: string | null = null;
let refreshTimer: NodeJS.Timeout | null = null;

interface PinggyTunnel {
  name: string;
  proto: string;
  public_url: string;
  config: {
    addr: string;
  };
}

interface PinggyApiResponse {
  tunnels: PinggyTunnel[];
}

export async function startPinggyAndGetDomain(port: number = 5000): Promise<string | null> {
  try {
    console.log('🔗 Starting Pinggy tunnel...');
    
    // Check if tunnel is already running
    const currentDomain = await getPinggyDomain();
    if (currentDomain) {
      console.log(`✅ Pinggy already running: ${currentDomain}`);
      pinggyDomain = currentDomain;
      scheduleRefresh();
      return currentDomain;
    }

    // Start Pinggy tunnel via SSH
    const domain = await createPinggyTunnel(port);
    if (domain) {
      return domain;
    }

    // Fallback: try with development environment simulation
    console.log('⚠️ Pinggy tunnel failed, falling back to localhost for development...');
    return `localhost:${port}`;
  } catch (error) {
    console.error('❌ Error starting Pinggy:', error);
    console.log('⚠️ Falling back to localhost for development...');
    return `localhost:${port}`;
  }
}

async function createPinggyTunnel(port: number): Promise<string | null> {
  try {
    // Kill existing process if any
    if (pinggyProcess) {
      pinggyProcess.kill();
    }

    console.log(`🔧 Creating Pinggy tunnel for port ${port}...`);

    // Start Pinggy tunnel using SSH with proper options
    pinggyProcess = spawn('ssh', [
      '-p', '443',
      '-R', `0:localhost:${port}`,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'LogLevel=ERROR',
      'a.pinggy.io'
    ], {
      stdio: 'pipe',
      detached: false
    });

    // Handle process events
    pinggyProcess.on('error', (error: Error) => {
      console.error('❌ Pinggy process error:', error);
    });

    let tunnelEstablished = false;
    
    pinggyProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log('Pinggy stdout:', output);
      
      // Extract domain from SSH output - look for Pinggy-specific patterns
      const lines = output.split('\n');
      for (const line of lines) {
        // Look for the actual tunnel URLs, not the dashboard
        if (line.includes('://') && line.includes('.pinggy.') && !line.includes('dashboard.pinggy.io')) {
          const httpsMatch = line.match(/https:\/\/([^\/\s]+)/);
          const httpMatch = line.match(/http:\/\/([^\/\s]+)/);
          
          if (httpsMatch && httpsMatch[1]) {
            pinggyDomain = httpsMatch[1];
            tunnelEstablished = true;
            console.log(`✅ Pinggy tunnel ready (HTTPS): ${pinggyDomain}`);
            break;
          } else if (httpMatch && httpMatch[1]) {
            pinggyDomain = httpMatch[1];
            tunnelEstablished = true;
            console.log(`✅ Pinggy tunnel ready (HTTP): ${pinggyDomain}`);
            break;
          }
        }
      }
    });

    pinggyProcess.stderr?.on('data', (data: Buffer) => {
      const errorOutput = data.toString();
      console.log('Pinggy stderr:', errorOutput);
      
      // Also check stderr for domain information
      const domainMatch = errorOutput.match(/https?:\/\/([^\/\s]+)/);
      if (domainMatch) {
        pinggyDomain = domainMatch[1];
        tunnelEstablished = true;
        console.log(`✅ Pinggy tunnel ready (from stderr): ${pinggyDomain}`);
      }
    });

    // Wait for tunnel to establish
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Try to get domain from process output
    let domain = pinggyDomain;
    
    if (domain) {
      console.log(`✅ Pinggy tunnel established: ${domain}`);
      scheduleRefresh();
      return domain;
    }

    console.error('❌ Failed to establish Pinggy tunnel - no domain extracted');
    return null;

  } catch (error) {
    console.error('❌ Error creating Pinggy tunnel:', error);
    return null;
  }
}

export async function getPinggyDomain(): Promise<string | null> {
  try {
    // Try to get domain from Pinggy API (if available)
    // Note: Pinggy may not have a local API like ngrok, so we'll rely on cached domain
    if (pinggyDomain) {
      return pinggyDomain;
    }

    // Alternative: Try to extract from process output or use SSH to query
    // For now, return cached domain
    return null;
  } catch (error) {
    console.error('Error fetching Pinggy domain:', error);
    return pinggyDomain; // Fallback to cached
  }
}

function scheduleRefresh(): void {
  // Clear existing timer
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  // Schedule refresh after 50 minutes (3000000ms)
  refreshTimer = setTimeout(async () => {
    console.log('🔄 Refreshing Pinggy tunnel...');
    await refreshPinggyTunnel();
  }, 50 * 60 * 1000); // 50 minutes

  console.log('⏰ Pinggy tunnel refresh scheduled for 50 minutes');
}

async function refreshPinggyTunnel(): Promise<void> {
  try {
    console.log('🔄 Starting Pinggy tunnel refresh...');
    
    // Stop current tunnel
    if (pinggyProcess) {
      pinggyProcess.kill();
      pinggyProcess = null;
    }

    // Clear cached domain
    pinggyDomain = null;

    // Start new tunnel
    const newDomain = await createPinggyTunnel(5000);
    if (newDomain) {
      console.log(`✅ Pinggy tunnel refreshed: ${newDomain}`);
      pinggyDomain = newDomain;
    } else {
      console.error('❌ Failed to refresh Pinggy tunnel');
    }
  } catch (error) {
    console.error('❌ Error refreshing Pinggy tunnel:', error);
  }
}

export async function getCurrentPinggyDomain(): Promise<string | null> {
  // Always return the most current domain
  if (pinggyDomain) {
    return pinggyDomain;
  }
  
  // If no domain available, try to get it again
  const domain = await getPinggyDomain();
  if (domain) {
    return domain;
  }
  
  // Final fallback for development
  return 'localhost:5000';
}

export function stopPinggy(): void {
  if (pinggyProcess) {
    console.log('🛑 Stopping Pinggy...');
    pinggyProcess.kill();
    pinggyProcess = null;
  }
  
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  
  pinggyDomain = null;
}

// Cleanup on exit
process.on('exit', stopPinggy);
process.on('SIGINT', stopPinggy);
process.on('SIGTERM', stopPinggy);