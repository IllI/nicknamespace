/**
 * Bambu Lab Printer API Client
 * Handles direct communication with Bambu Lab printers
 */

export interface BambuPrinterConfig {
  ip: string;
  accessCode: string;
  serial: string;
}

export interface PrintJobStatus {
  id: string;
  status: 'idle' | 'printing' | 'paused' | 'failed' | 'finished';
  progress: number;
  remainingTime: number;
  currentLayer: number;
  totalLayers: number;
  filename: string;
}

export interface PrinterInfo {
  serial: string;
  model: string;
  firmware: string;
  status: string;
  temperature: {
    bed: number;
    nozzle: number;
  };
  connected: boolean;
}

export class BambuPrinterClient {
  private config: BambuPrinterConfig;
  private baseUrl: string;

  constructor(config: BambuPrinterConfig) {
    this.config = config;
    this.baseUrl = `http://${config.ip}`;
  }

  /**
   * Test connection to the printer
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/version`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessCode}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      return response.ok;
    } catch (error) {
      console.error('Printer connection test failed:', error);
      return false;
    }
  }

  /**
   * Get printer information and status
   */
  async getPrinterInfo(): Promise<PrinterInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/printer`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessCode}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        serial: data.serial || this.config.serial,
        model: data.model || 'Bambu Lab Printer',
        firmware: data.firmware || 'Unknown',
        status: data.status || 'unknown',
        temperature: {
          bed: data.bed_temp || 0,
          nozzle: data.nozzle_temp || 0,
        },
        connected: true,
      };
    } catch (error) {
      console.error('Failed to get printer info:', error);
      return null;
    }
  }

  /**
   * Upload G-code file to printer
   */
  async uploadGcode(gcodeBuffer: Buffer, filename: string): Promise<boolean> {
    try {
      const formData = new FormData();
      const blob = new Blob([gcodeBuffer], { type: 'text/plain' });
      formData.append('file', blob, filename);

      const response = await fetch(`${this.baseUrl}/api/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessCode}`,
        },
        body: formData,
        signal: AbortSignal.timeout(60000), // 60 second timeout for file upload
      });

      if (!response.ok) {
        throw new Error(`Upload failed: HTTP ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('G-code upload failed:', error);
      return false;
    }
  }

  /**
   * Start a print job
   */
  async startPrint(filename: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/files/${filename}/print`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessCode}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to start print:', error);
      return false;
    }
  }

  /**
   * Get current print job status
   */
  async getPrintStatus(): Promise<PrintJobStatus | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/job`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessCode}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      return {
        id: data.id || 'unknown',
        status: this.mapPrinterStatus(data.state),
        progress: data.progress?.completion || 0,
        remainingTime: data.progress?.printTimeLeft || 0,
        currentLayer: data.progress?.currentLayer || 0,
        totalLayers: data.progress?.totalLayers || 0,
        filename: data.job?.file?.name || 'unknown',
      };
    } catch (error) {
      console.error('Failed to get print status:', error);
      return null;
    }
  }

  /**
   * Cancel current print job
   */
  async cancelPrint(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/job`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.accessCode}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to cancel print:', error);
      return false;
    }
  }

  /**
   * Pause current print job
   */
  async pausePrint(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/job/pause`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessCode}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to pause print:', error);
      return false;
    }
  }

  /**
   * Resume paused print job
   */
  async resumePrint(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/job/resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessCode}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to resume print:', error);
      return false;
    }
  }

  /**
   * Map printer status to our internal status
   */
  private mapPrinterStatus(printerStatus: string): PrintJobStatus['status'] {
    switch (printerStatus?.toLowerCase()) {
      case 'printing':
        return 'printing';
      case 'paused':
        return 'paused';
      case 'error':
      case 'failed':
        return 'failed';
      case 'finished':
      case 'complete':
        return 'finished';
      default:
        return 'idle';
    }
  }
}

/**
 * Factory function to create printer client from database job
 */
export function createPrinterClient(printerIp: string, printerSerial: string, accessCode?: string): BambuPrinterClient {
  return new BambuPrinterClient({
    ip: printerIp,
    serial: printerSerial,
    accessCode: accessCode || process.env.BAMBU_ACCESS_CODE || 'default-access-code',
  });
}

/**
 * Test printer connectivity
 */
export async function testPrinterConnection(printerIp: string, accessCode?: string): Promise<boolean> {
  const client = new BambuPrinterClient({
    ip: printerIp,
    serial: 'test',
    accessCode: accessCode || process.env.BAMBU_ACCESS_CODE || 'default-access-code',
  });

  return await client.testConnection();
}