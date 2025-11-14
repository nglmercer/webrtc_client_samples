// logger.ts - Sistema de logging centralizado y configurable

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  OFF = 4
}

export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  enableConsole?: boolean;
  enableStorage?: boolean;
  maxLogEntries?: number;
}

class Logger {
  private static instance: Logger;
  private config: LoggerConfig = {
    level: LogLevel.INFO,
    prefix: '[WebRTC-App]',
    enableConsole: true,
    enableStorage: false,
    maxLogEntries: 1000
  };

  private logStorage: Array<{ timestamp: number; level: LogLevel; message: string; data?: any }> = [];

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.config.enableStorage) {
      this.loadStoredLogs();
    }
  }

  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  public getLevel(): LogLevel {
    return this.config.level;
  }

  public debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data, '#6b7280');
  }

  public info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data, '#3b82f6');
  }

  public warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data, '#f59e0b');
  }

  public error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data, '#ef4444');
  }

  private log(level: LogLevel, message: string, data: any, color: string): void {
    if (level < this.config.level) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const prefix = this.config.prefix || '[Logger]';
    const formattedMessage = `${prefix} [${levelName}] ${message}`;

    // Console logging
    if (this.config.enableConsole) {
      const style = `color: ${color}; font-weight: bold;`;
      if (data) {
        console.log(`%c${formattedMessage}`, style, data);
      } else {
        console.log(`%c${formattedMessage}`, style);
      }
    }

    // Storage logging
    if (this.config.enableStorage) {
      this.addToStorage(level, message, data);
    }
  }

  private addToStorage(level: LogLevel, message: string, data?: any): void {
    this.logStorage.push({
      timestamp: Date.now(),
      level,
      message,
      data
    });

    // Limitar el tamaño del storage
    if (this.logStorage.length > (this.config.maxLogEntries || 1000)) {
      this.logStorage.shift();
    }

    // Guardar en localStorage
    try {
      localStorage.setItem('webrtc-app-logs', JSON.stringify(this.logStorage));
    } catch (error) {
      console.warn('No se pudo guardar logs en localStorage:', error);
    }
  }

  private loadStoredLogs(): void {
    try {
      const stored = localStorage.getItem('webrtc-app-logs');
      if (stored) {
        this.logStorage = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('No se pudo cargar logs desde localStorage:', error);
    }
  }

  public getLogs(level?: LogLevel): Array<{ timestamp: number; level: LogLevel; message: string; data?: any }> {
    if (level !== undefined) {
      return this.logStorage.filter(log => log.level >= level);
    }
    return [...this.logStorage];
  }

  public clearLogs(): void {
    this.logStorage = [];
    try {
      localStorage.removeItem('webrtc-app-logs');
    } catch (error) {
      console.warn('No se pudo limpiar logs desde localStorage:', error);
    }
  }

  public exportLogs(): string {
    return JSON.stringify(this.logStorage, null, 2);
  }

  // Métodos específicos para WebRTC
  public webrtcDebug(message: string, data?: any): void {
    this.debug(`WebRTC: ${message}`, data);
  }

  public webrtcInfo(message: string, data?: any): void {
    this.info(`WebRTC: ${message}`, data);
  }

  public webrtcWarn(message: string, data?: any): void {
    this.warn(`WebRTC: ${message}`, data);
  }

  public webrtcError(message: string, data?: any): void {
    this.error(`WebRTC: ${message}`, data);
  }

  // Métodos específicos para Signaling
  public signalingDebug(message: string, data?: any): void {
    this.debug(`Signaling: ${message}`, data);
  }

  public signalingInfo(message: string, data?: any): void {
    this.info(`Signaling: ${message}`, data);
  }

  public signalingWarn(message: string, data?: any): void {
    this.warn(`Signaling: ${message}`, data);
  }

  public signalingError(message: string, data?: any): void {
    this.error(`Signaling: ${message}`, data);
  }

  // Métodos específicos para Media
  public mediaDebug(message: string, data?: any): void {
    this.debug(`Media: ${message}`, data);
  }

  public mediaInfo(message: string, data?: any): void {
    this.info(`Media: ${message}`, data);
  }

  public mediaWarn(message: string, data?: any): void {
    this.warn(`Media: ${message}`, data);
  }

  public mediaError(message: string, data?: any): void {
    this.error(`Media: ${message}`, data);
  }
}

// Exportar instancia singleton
export const logger = Logger.getInstance();

// Configuración por defecto para desarrollo
if (process.env.NODE_ENV === 'development') {
  logger.configure({
    level: LogLevel.DEBUG,
    enableConsole: true,
    enableStorage: true
  });
} else {
  logger.configure({
    level: LogLevel.INFO,
    enableConsole: true,
    enableStorage: false
  });
}

// Función para configurar desde código de la aplicación
export function configureLogger(config: Partial<LoggerConfig>): void {
  logger.configure(config);
}

// Funciones de conveniencia para exportación
export const { debug, info, warn, error, webrtcDebug, webrtcInfo, webrtcWarn, webrtcError, signalingDebug, signalingInfo, signalingWarn, signalingError, mediaDebug, mediaInfo, mediaWarn, mediaError } = logger;
