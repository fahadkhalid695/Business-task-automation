import { TranscriptionService } from '../communication-service/TranscriptionService';
import { SpeechClient } from '@google-cloud/speech';

// Mock Google Cloud Speech
jest.mock('@google-cloud/speech');

describe('TranscriptionService', () => {
  let transcriptionService: TranscriptionService;
  let mockSpeechClient: jest.Mocked<SpeechClient>;

  const mockConfig = {
    projectId: 'test-project',
    keyFilename: 'test-key.json'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock SpeechClient
    mockSpeechClient = {
      recognize: jest.fn(),
      streamingRecognize: jest.fn()
    } as any;

    (SpeechClient as jest.Mock).mockImplementation(() => mockSpeechClient);

    transcriptionService = new TranscriptionService(mockConfig);
  });

  describe('transcribe', () => {
    const mockAudioBuffer = Buffer.from('mock audio data');
    const mockGoogleResponse = [
      {
        results: [
          {
            alternatives: [
              {
                transcript: 'Hello, this is a test transcription.',
                confidence: 0.95,
                words: [
                  {
                    word: 'Hello',
                    startTime: { seconds: '0', nanos: '0' },
                    endTime: { seconds: '1', nanos: '0' },
                    confidence: 0.98
                  },
                  {
                    word: 'this',
                    startTime: { seconds: '1', nanos: '500000000' },
                    endTime: { seconds: '2', nanos: '0' },
                    confidence: 0.95
                  }
                ]
              }
            ]
          }
        ]
      }
    ];

    beforeEach(() => {
      mockSpeechClient.recognize.mockResolvedValue(mockGoogleResponse);
    });

    it('should transcribe audio successfully', async () => {
      const options = {
        language: 'en-US',
        enableSpeakerDiarization: false,
        enableWordTimestamps: true
      };

      const result = await transcriptionService.transcribe(mockAudioBuffer, options);

      expect(result).toEqual(
        expect.objectContaining({
          id: expect.stringMatching(/^transcription_/),
          text: 'Hello, this is a test transcription.',
          confidence: 0.95,
          language: 'en-US',
          timestamps: expect.arrayContaining([
            expect.objectContaining({
              word: 'Hello',
              startTime: 0,
              endTime: 1,
              confidence: 0.98
            })
          ]),
          metadata: expect.objectContaining({
            audioFormat: 'wav',
            sampleRate: 16000,
            channels: 1,
            model: 'google-speech-latest_long'
          })
        })
      );

      expect(mockSpeechClient.recognize).toHaveBeenCalledWith(
        expect.objectContaining({
          audio: { content: mockAudioBuffer.toString('base64') },
          config: expect.objectContaining({
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: 'en-US',
            enableWordTimeOffsets: true,
            enableSpeakerDiarization: false
          })
        })
      );
    });

    it('should handle speaker diarization', async () => {
      const diarizationResponse = [
        {
          results: [
            {
              alternatives: [
                {
                  transcript: 'Speaker one says hello. Speaker two responds.',
                  confidence: 0.9,
                  words: [
                    {
                      word: 'Speaker',
                      startTime: { seconds: '0', nanos: '0' },
                      endTime: { seconds: '1', nanos: '0' },
                      speakerTag: 1
                    },
                    {
                      word: 'one',
                      startTime: { seconds: '1', nanos: '0' },
                      endTime: { seconds: '2', nanos: '0' },
                      speakerTag: 1
                    },
                    {
                      word: 'responds',
                      startTime: { seconds: '5', nanos: '0' },
                      endTime: { seconds: '6', nanos: '0' },
                      speakerTag: 2
                    }
                  ]
                }
              ]
            }
          ]
        }
      ];

      mockSpeechClient.recognize.mockResolvedValue(diarizationResponse);

      const options = {
        enableSpeakerDiarization: true,
        enableWordTimestamps: true
      };

      const result = await transcriptionService.transcribe(mockAudioBuffer, options);

      expect(result.speakers).toBeDefined();
      expect(result.speakers).toHaveLength(2);
      expect(result.speakers![0]).toEqual(
        expect.objectContaining({
          speaker: 'Speaker 1',
          startTime: 0,
          endTime: 2,
          text: expect.stringContaining('Speaker one')
        })
      );
    });

    it('should handle different audio formats', async () => {
      // Test MP3 format detection
      const mp3Buffer = Buffer.concat([
        Buffer.from('ID3'), // MP3 header
        Buffer.alloc(100, 0)
      ]);

      const result = await transcriptionService.transcribe(mp3Buffer);

      expect(mockSpeechClient.recognize).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            encoding: 'MP3'
          })
        })
      );
    });

    it('should handle FLAC format', async () => {
      const flacBuffer = Buffer.concat([
        Buffer.from('fLaC'), // FLAC header
        Buffer.alloc(100, 0)
      ]);

      await transcriptionService.transcribe(flacBuffer);

      expect(mockSpeechClient.recognize).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            encoding: 'FLAC'
          })
        })
      );
    });

    it('should handle empty transcription results', async () => {
      mockSpeechClient.recognize.mockResolvedValue([{ results: [] }]);

      await expect(
        transcriptionService.transcribe(mockAudioBuffer)
      ).rejects.toThrow('No transcription results returned');
    });

    it('should handle API errors', async () => {
      mockSpeechClient.recognize.mockRejectedValue(new Error('Google Speech API error'));

      await expect(
        transcriptionService.transcribe(mockAudioBuffer)
      ).rejects.toThrow('Transcription failed: Google Speech API error');
    });

    it('should calculate duration correctly', async () => {
      const longTranscriptionResponse = [
        {
          results: [
            {
              alternatives: [
                {
                  transcript: 'This is a longer transcription.',
                  confidence: 0.9,
                  words: [
                    {
                      word: 'This',
                      startTime: { seconds: '0', nanos: '0' },
                      endTime: { seconds: '1', nanos: '0' }
                    },
                    {
                      word: 'transcription',
                      startTime: { seconds: '8', nanos: '500000000' },
                      endTime: { seconds: '10', nanos: '0' }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ];

      mockSpeechClient.recognize.mockResolvedValue(longTranscriptionResponse);

      const result = await transcriptionService.transcribe(mockAudioBuffer);

      expect(result.duration).toBe(10); // Should be the end time of the last word
    });
  });

  describe('transcribeStream', () => {
    it('should handle streaming transcription', async () => {
      const mockStream = {
        pipe: jest.fn(),
        [Symbol.asyncIterator]: async function* () {
          yield {
            results: [
              {
                alternatives: [
                  {
                    transcript: 'Streaming transcription result',
                    confidence: 0.8
                  }
                ]
              }
            ]
          };
        }
      };

      mockSpeechClient.streamingRecognize.mockReturnValue(mockStream as any);

      const audioStream = {
        pipe: jest.fn()
      } as any;

      const generator = await transcriptionService.transcribeStream(audioStream);
      const results = [];

      for await (const result of generator) {
        results.push(result);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        text: 'Streaming transcription result',
        confidence: 0.8,
        language: 'en-US'
      });

      expect(audioStream.pipe).toHaveBeenCalledWith(mockStream);
    });

    it('should handle streaming with custom options', async () => {
      const mockStream = {
        pipe: jest.fn(),
        [Symbol.asyncIterator]: async function* () {}
      };

      mockSpeechClient.streamingRecognize.mockReturnValue(mockStream as any);

      const audioStream = { pipe: jest.fn() } as any;
      const options = {
        language: 'es-ES',
        enableSpeakerDiarization: true,
        sampleRate: 44100
      };

      await transcriptionService.transcribeStream(audioStream, options);

      expect(mockSpeechClient.streamingRecognize).toHaveBeenCalledWith({
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 44100,
          languageCode: 'es-ES',
          enableSpeakerDiarization: true
        },
        interimResults: true
      });
    });
  });

  describe('helper methods', () => {
    it('should detect WAV format correctly', async () => {
      const wavBuffer = Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.alloc(4, 0),
        Buffer.from('WAVE'),
        Buffer.alloc(100, 0)
      ]);

      await transcriptionService.transcribe(wavBuffer);

      expect(mockSpeechClient.recognize).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            encoding: 'LINEAR16'
          })
        })
      );
    });

    it('should convert duration correctly', async () => {
      const responseWithNanos = [
        {
          results: [
            {
              alternatives: [
                {
                  transcript: 'Test',
                  confidence: 0.9,
                  words: [
                    {
                      word: 'Test',
                      startTime: { seconds: '1', nanos: '500000000' },
                      endTime: { seconds: '2', nanos: '750000000' }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ];

      mockSpeechClient.recognize.mockResolvedValue(responseWithNanos);

      const result = await transcriptionService.transcribe(mockAudioBuffer);

      expect(result.timestamps[0].startTime).toBe(1.5);
      expect(result.timestamps[0].endTime).toBe(2.75);
    });

    it('should generate unique IDs', async () => {
      const result1 = await transcriptionService.transcribe(mockAudioBuffer);
      const result2 = await transcriptionService.transcribe(mockAudioBuffer);

      expect(result1.id).not.toBe(result2.id);
      expect(result1.id).toMatch(/^transcription_\d+_[a-z0-9]+$/);
    });
  });
});