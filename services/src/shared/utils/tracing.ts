import { Logger } from './logger';
import { performance } from 'perf_hooks';
import { randomBytes } from 'crypto';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Record<string, string>;
}

export interface SpanData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    fields: Record<string, any>;
  }>;
  status: 'ok' | 'error' | 'timeout';
  service: string;
  component: string;
}

export interface TraceData {
  traceId: string;
  spans: SpanData[];
  startTime: number;
  endTime?: number;
  duration?: number;
  services: string[];
  status: 'ok' | 'error' | 'timeout';
}

export class Span {
  private data: SpanData;
  private logger: Logger;
  private finished: boolean = false;

  constructor(
    traceId: string,
    spanId: string,
    operationName: string,
    parentSpanId?: string,
    service: string = 'unknown',
    component: string = 'unknown'
  ) {
    this.data = {
      traceId,
      spanId,
      parentSpanId,
      operationName,
      startTime: performance.now(),
      tags: {},
      logs: [],
      status: 'ok',
      service,
      component
    };
    
    this.logger = new Logger(`Span:${operationName}`);
  }

  setTag(key: string, value: any): Span {
    this.data.tags[key] = value;
    return this;
  }

  setTags(tags: Record<string, any>): Span {
    Object.assign(this.data.tags, tags);
    return this;
  }

  log(fields: Record<string, any>): Span {
    this.data.logs.push({
      timestamp: performance.now(),
      fields
    });
    return this;
  }

  logError(error: Error): Span {
    this.setTag('error', true);
    this.setTag('error.kind', error.name);
    this.setTag('error.message', error.message);
    this.setTag('error.stack', error.stack);
    this.data.status = 'error';
    
    this.log({
      level: 'error',
      message: error.message,
      stack: error.stack
    });
    
    return this;
  }

  setStatus(status: 'ok' | 'error' | 'timeout'): Span {
    this.data.status = status;
    return this;
  }

  finish(): SpanData {
    if (this.finished) {
      return this.data;
    }

    this.data.endTime = performance.now();
    this.data.duration = this.data.endTime - this.data.startTime;
    this.finished = true;

    // Log span completion
    this.logger.debug(`Span completed: ${this.data.operationName}`, {
      traceId: this.data.traceId,
      spanId: this.data.spanId,
      duration: this.data.duration,
      status: this.data.status
    });

    // Register with tracer
    const tracer = DistributedTracer.getInstance();
    tracer.recordSpan(this.data);

    return this.data;
  }

  getContext(): TraceContext {
    return {
      traceId: this.data.traceId,
      spanId: this.data.spanId,
      parentSpanId: this.data.parentSpanId
    };
  }

  getData(): SpanData {
    return { ...this.data };
  }
}

export class DistributedTracer {
  private static instance: DistributedTracer;
  private activeSpans: Map<string, Span> = new Map();
  private completedTraces: Map<string, TraceData> = new Map();
  private logger: Logger;
  private maxTraces: number = 1000;
  private traceTimeout: number = 300000; // 5 minutes

  private constructor() {
    this.logger = new Logger('DistributedTracer');
    this.startTraceCleanup();
  }

  static getInstance(): DistributedTracer {
    if (!DistributedTracer.instance) {
      DistributedTracer.instance = new DistributedTracer();
    }
    return DistributedTracer.instance;
  }

  startSpan(
    operationName: string,
    parentContext?: TraceContext,
    service?: string,
    component?: string
  ): Span {
    const traceId = parentContext?.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();
    const parentSpanId = parentContext?.spanId;

    const span = new Span(
      traceId,
      spanId,
      operationName,
      parentSpanId,
      service || process.env.SERVICE_NAME || 'unknown',
      component || 'unknown'
    );

    this.activeSpans.set(spanId, span);

    this.logger.debug(`Started span: ${operationName}`, {
      traceId,
      spanId,
      parentSpanId,
      service,
      component
    });

    return span;
  }

  recordSpan(spanData: SpanData): void {
    // Remove from active spans
    this.activeSpans.delete(spanData.spanId);

    // Add to trace
    let trace = this.completedTraces.get(spanData.traceId);
    if (!trace) {
      trace = {
        traceId: spanData.traceId,
        spans: [],
        startTime: spanData.startTime,
        services: [],
        status: 'ok'
      };
      this.completedTraces.set(spanData.traceId, trace);
    }

    trace.spans.push(spanData);
    
    // Update trace metadata
    if (!trace.services.includes(spanData.service)) {
      trace.services.push(spanData.service);
    }

    if (spanData.status === 'error') {
      trace.status = 'error';
    }

    // Update trace timing
    trace.startTime = Math.min(trace.startTime, spanData.startTime);
    if (spanData.endTime) {
      trace.endTime = Math.max(trace.endTime || 0, spanData.endTime);
      trace.duration = trace.endTime - trace.startTime;
    }

    // Check if trace is complete (no more active spans for this trace)
    const hasActiveSpans = Array.from(this.activeSpans.values())
      .some(span => span.getContext().traceId === spanData.traceId);

    if (!hasActiveSpans) {
      this.finalizeTrace(trace);
    }
  }

  private finalizeTrace(trace: TraceData): void {
    this.logger.info(`Trace completed: ${trace.traceId}`, {
      traceId: trace.traceId,
      duration: trace.duration,
      spanCount: trace.spans.length,
      services: trace.services,
      status: trace.status
    });

    // Analyze trace for performance issues
    this.analyzeTrace(trace);
  }

  private analyzeTrace(trace: TraceData): void {
    const slowSpans = trace.spans.filter(span => 
      span.duration && span.duration > 1000 // > 1 second
    );

    if (slowSpans.length > 0) {
      this.logger.warn(`Slow spans detected in trace ${trace.traceId}`, {
        traceId: trace.traceId,
        slowSpans: slowSpans.map(span => ({
          operation: span.operationName,
          duration: span.duration,
          service: span.service
        }))
      });
    }

    const errorSpans = trace.spans.filter(span => span.status === 'error');
    if (errorSpans.length > 0) {
      this.logger.error(`Errors detected in trace ${trace.traceId}`, {
        traceId: trace.traceId,
        errorSpans: errorSpans.map(span => ({
          operation: span.operationName,
          service: span.service,
          error: span.tags.error
        }))
      });
    }
  }

  getTrace(traceId: string): TraceData | undefined {
    return this.completedTraces.get(traceId);
  }

  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  getTraceStats(): {
    activeSpans: number;
    completedTraces: number;
    averageTraceDuration: number;
    errorRate: number;
  } {
    const traces = Array.from(this.completedTraces.values());
    const totalDuration = traces.reduce((sum, trace) => sum + (trace.duration || 0), 0);
    const errorTraces = traces.filter(trace => trace.status === 'error').length;

    return {
      activeSpans: this.activeSpans.size,
      completedTraces: traces.length,
      averageTraceDuration: traces.length > 0 ? totalDuration / traces.length : 0,
      errorRate: traces.length > 0 ? errorTraces / traces.length : 0
    };
  }

  // Extract trace context from HTTP headers
  extractContext(headers: Record<string, string>): TraceContext | undefined {
    const traceId = headers['x-trace-id'];
    const spanId = headers['x-span-id'];
    const parentSpanId = headers['x-parent-span-id'];

    if (!traceId || !spanId) {
      return undefined;
    }

    return {
      traceId,
      spanId,
      parentSpanId
    };
  }

  // Inject trace context into HTTP headers
  injectContext(context: TraceContext): Record<string, string> {
    const headers: Record<string, string> = {
      'x-trace-id': context.traceId,
      'x-span-id': context.spanId
    };

    if (context.parentSpanId) {
      headers['x-parent-span-id'] = context.parentSpanId;
    }

    return headers;
  }

  private generateTraceId(): string {
    return randomBytes(16).toString('hex');
  }

  private generateSpanId(): string {
    return randomBytes(8).toString('hex');
  }

  private startTraceCleanup(): void {
    // Clean up old traces every 5 minutes
    setInterval(() => {
      this.cleanupOldTraces();
    }, 300000);
  }

  private cleanupOldTraces(): void {
    const now = performance.now();
    const cutoff = now - this.traceTimeout;
    
    // Clean up old completed traces
    const tracesToRemove: string[] = [];
    for (const [traceId, trace] of this.completedTraces) {
      if (trace.startTime < cutoff) {
        tracesToRemove.push(traceId);
      }
    }

    tracesToRemove.forEach(traceId => {
      this.completedTraces.delete(traceId);
    });

    // Clean up abandoned active spans
    const spansToRemove: string[] = [];
    for (const [spanId, span] of this.activeSpans) {
      const spanData = span.getData();
      if (spanData.startTime < cutoff) {
        spansToRemove.push(spanId);
      }
    }

    spansToRemove.forEach(spanId => {
      this.activeSpans.delete(spanId);
    });

    if (tracesToRemove.length > 0 || spansToRemove.length > 0) {
      this.logger.debug('Cleaned up old traces and spans', {
        removedTraces: tracesToRemove.length,
        removedSpans: spansToRemove.length
      });
    }

    // Limit total number of traces
    if (this.completedTraces.size > this.maxTraces) {
      const traces = Array.from(this.completedTraces.entries())
        .sort(([, a], [, b]) => a.startTime - b.startTime);
      
      const toRemove = traces.slice(0, traces.length - this.maxTraces);
      toRemove.forEach(([traceId]) => {
        this.completedTraces.delete(traceId);
      });

      this.logger.debug(`Removed ${toRemove.length} old traces to maintain limit`);
    }
  }
}

// Utility decorator for automatic tracing
export function traced(operationName?: string) {
  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<any>
  ) {
    const method = descriptor.value!;
    const opName = operationName || `${target.constructor.name}.${propertyName}`;
    
    descriptor.value = async function (...args: any[]) {
      const tracer = DistributedTracer.getInstance();
      const span = tracer.startSpan(opName, undefined, process.env.SERVICE_NAME);
      
      try {
        const result = await method.apply(this, args);
        span.setTag('success', true);
        return result;
      } catch (error) {
        span.logError(error as Error);
        throw error;
      } finally {
        span.finish();
      }
    };
  };
}

// Express middleware for tracing HTTP requests
export const tracingMiddleware = (req: any, res: any, next: any) => {
  const tracer = DistributedTracer.getInstance();
  
  // Extract parent context from headers
  const parentContext = tracer.extractContext(req.headers);
  
  // Start new span for this request
  const span = tracer.startSpan(
    `${req.method} ${req.path}`,
    parentContext,
    process.env.SERVICE_NAME,
    'http'
  );

  // Add request details to span
  span.setTags({
    'http.method': req.method,
    'http.url': req.url,
    'http.path': req.path,
    'http.user_agent': req.get('User-Agent'),
    'http.remote_addr': req.ip
  });

  // Store span in request for use in handlers
  req.span = span;
  req.traceContext = span.getContext();

  // Finish span when response ends
  res.on('finish', () => {
    span.setTags({
      'http.status_code': res.statusCode,
      'http.response_size': res.get('Content-Length')
    });

    if (res.statusCode >= 400) {
      span.setStatus('error');
      span.setTag('error', true);
    }

    span.finish();
  });

  next();
};