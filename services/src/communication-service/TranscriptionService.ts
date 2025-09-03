import { SpeechClient } from '@google-cloud/speech';
import {
  TranscriptionResult,
  SpeakerSegment,
  WordTimestamp,
  TranscriptionMetadata
} from './types';
import { logger } from '../shared/utils/logger';

export class TranscriptionService {
  private speechClient: SpeechClient;
  private projectId: string;

  constructor(config: { projectId: string; keyFilename: string }) {
    this.projectId = config.projectId;
    this.speechClient = new SpeechClient({
      projectId: config.projectId,
      keyFilename: config.keyFilename
    });
  }

  /**
   * Transcribe audio with speaker identification
   * Requirement 3.2: Generate accurate transcriptions with speaker identification
   */
  async transcribe(
    audioBuffer: Buffer,
    options: {
      language?: string;
      enableSpeakerDiarization?: boolean;
      enableWordTimestamps?: boolean;
      audioFormat?: string;
      sampleRate?: number;
    } = {}
  ): Promise<TranscriptionResult> {
    try {
      const startTime = Date.now();
      
      logger.info('Starting audio transcription', {
        audioSize: audioBuffer.length,
        language: options.language || 'en-US',
        enableSpeakerDiarization: options.enableSpeakerDiarization || false
      });

      // Detect audio format and sample rate if not provided
      const audioMetadata = await this.detectAudioMetadata(audioBuffer);
      const audioFormat = options.audioFormat || audioMetadata.format;
      const sampleRate = options.sampleRate || audioMetadata.sampleRate;

      // Configure the request
      const request = {
        audio: {
          content: audioBuffer.toString('base64')
        },
        config: {
          encoding: this.getGoogleAudioEncoding(audioFormat),
          sampleRateHertz: sampleRate,
          languageCode: options.language || 'en-US',
          enableWordTimeOffsets: options.enableWordTimestamps || true,
          enableSpeakerDiarization: options.enableSpeakerDiarization || false,
          diarizationSpeakerCount: options.enableSpeakerDiarization ? 2 : undefined,
          model: 'latest_long',
          useEnhanced: true
        }
      };

      // Perform the transcription
      const [response] = await this.speechClient.recognize(request);
      
      if (!response.results || response.results.length === 0) {
        throw new Error('No transcription results returned');
      }

      // Process the results
      const transcriptionText = response.results
        .map(result => result.alternatives?.[0]?.transcript || '')
        .join(' ');

      const confidence = response.results.reduce((sum, result) => {
        return sum + (result.alternatives?.[0]?.confidence || 0);
      }, 0) / response.results.length;

      // Extract word timestamps
      const wordTimestamps: WordTimestamp[] = [];
      response.results.forEach(result => {
        result.alternatives?.[0]?.words?.forEach(wordInfo => {
          if (wordInfo.word && wordInfo.startTime && wordInfo.endTime) {
            wordTimestamps.push({
              word: wordInfo.word,
              startTime: this.convertDurationToSeconds(wordInfo.startTime),
              endTime: this.convertDurationToSeconds(wordInfo.endTime),
              confidence: wordInfo.confidence || 0
            });
          }
        });
      });

      // Extract speaker segments if diarization is enabled
      const speakers: SpeakerSegment[] = [];
      if (options.enableSpeakerDiarization && response.results) {
        speakers.push(...this.extractSpeakerSegments(response.results, transcriptionText));
      }

      const processingTime = Date.now() - startTime;
      const duration = wordTimestamps.length > 0 
        ? wordTimestamps[wordTimestamps.length - 1].endTime 
        : 0;

      const result: TranscriptionResult = {
        id: this.generateId(),
        text: transcriptionText,
        confidence,
        language: options.language || 'en-US',
        speakers: speakers.length > 0 ? speakers : undefined,
        duration,
        timestamps: wordTimestamps,
        metadata: {
          audioFormat,
          sampleRate,
          channels: audioMetadata.channels,
          processingTime,
          model: 'google-speech-latest_long'
        }
      };

      logger.info('Audio transcription completed', {
        transcriptionId: result.id,
        textLength: result.text.length,
        confidence: result.confidence,
        processingTime
      });

      return result;

    } catch (error) {
      logger.error('Error transcribing audio', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * Transcribe audio in real-time (streaming)
   */
  async transcribeStream(
    audioStream: NodeJS.ReadableStream,
    options: {
      language?: string;
      enableSpeakerDiarization?: boolean;
      sampleRate?: number;
    } = {}
  ): Promise<AsyncGenerator<Partial<TranscriptionResult>, void, unknown>> {
    const recognizeStream = this.speechClient
      .streamingRecognize({
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: options.sampleRate || 16000,
          languageCode: options.language || 'en-US',
          enableSpeakerDiarization: options.enableSpeakerDiarization || false
        },
        interimResults: true
      });

    audioStream.pipe(recognizeStream);

    async function* generateResults() {
      for await (const response of recognizeStream) {
        if (response.results && response.results.length > 0) {
          const result = response.results[0];
          const alternative = result.alternatives?.[0];
          
          if (alternative) {
            yield {
              text: alternative.transcript,
              confidence: alternative.confidence,
              language: options.language || 'en-US'
            };
          }
        }
      }
    }

    return generateResults();
  }

  // Private helper methods
  private async detectAudioMetadata(audioBuffer: Buffer): Promise<{
    format: string;
    sampleRate: number;
    channels: number;
  }> {
    // Simple audio format detection based on file headers
    // In a real implementation, you'd use a proper audio analysis library
    
    const header = audioBuffer.slice(0, 12);
    
    if (header.includes(Buffer.from('RIFF')) && header.includes(Buffer.from('WAVE'))) {
      return {
        format: 'wav',
        sampleRate: 16000, // Default assumption
        channels: 1
      };
    } else if (header.slice(0, 3).toString() === 'ID3' || header.slice(0, 2).toString('hex') === 'fffa') {
      return {
        format: 'mp3',
        sampleRate: 44100,
        channels: 2
      };
    } else if (header.slice(0, 4).toString() === 'fLaC') {
      return {
        format: 'flac',
        sampleRate: 44100,
        channels: 2
      };
    }

    // Default fallback
    return {
      format: 'wav',
      sampleRate: 16000,
      channels: 1
    };
  }

  private getGoogleAudioEncoding(format: string): string {
    const encodingMap: { [key: string]: string } = {
      'wav': 'LINEAR16',
      'mp3': 'MP3',
      'flac': 'FLAC',
      'ogg': 'OGG_OPUS',
      'webm': 'WEBM_OPUS'
    };

    return encodingMap[format.toLowerCase()] || 'LINEAR16';
  }

  private convertDurationToSeconds(duration: any): number {
    if (!duration) return 0;
    
    const seconds = parseInt(duration.seconds || '0');
    const nanos = parseInt(duration.nanos || '0');
    
    return seconds + (nanos / 1000000000);
  }

  private extractSpeakerSegments(results: any[], fullText: string): SpeakerSegment[] {
    const segments: SpeakerSegment[] = [];
    let currentSpeaker = '';
    let currentText = '';
    let currentStartTime = 0;
    let currentEndTime = 0;

    results.forEach(result => {
      result.alternatives?.[0]?.words?.forEach((wordInfo: any) => {
        const speakerTag = wordInfo.speakerTag || 1;
        const speaker = `Speaker ${speakerTag}`;
        const word = wordInfo.word || '';
        const startTime = this.convertDurationToSeconds(wordInfo.startTime);
        const endTime = this.convertDurationToSeconds(wordInfo.endTime);

        if (speaker !== currentSpeaker) {
          // Save previous segment if exists
          if (currentSpeaker && currentText.trim()) {
            segments.push({
              speaker: currentSpeaker,
              startTime: currentStartTime,
              endTime: currentEndTime,
              text: currentText.trim(),
              confidence: 0.8 // Default confidence for speaker segments
            });
          }

          // Start new segment
          currentSpeaker = speaker;
          currentText = word;
          currentStartTime = startTime;
          currentEndTime = endTime;
        } else {
          // Continue current segment
          currentText += ' ' + word;
          currentEndTime = endTime;
        }
      });
    });

    // Add final segment
    if (currentSpeaker && currentText.trim()) {
      segments.push({
        speaker: currentSpeaker,
        startTime: currentStartTime,
        endTime: currentEndTime,
        text: currentText.trim(),
        confidence: 0.8
      });
    }

    return segments;
  }

  private generateId(): string {
    return `transcription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}